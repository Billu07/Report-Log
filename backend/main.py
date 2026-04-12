import asyncio
import logging
import mimetypes
import os
from datetime import date, datetime, timezone
from functools import partial
from pathlib import Path
from typing import Any, Optional
from uuid import uuid4

import google.generativeai as genai
import httpx
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile, Body
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from groq import AsyncGroq
from huggingface_hub import InferenceClient
from pydantic import BaseModel, Field
from supabase import Client, create_client

# --- CONFIGURATION ---
load_dotenv(Path(__file__).with_name(".env"))
load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("autolinium-api")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-pro")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
HUGGINGFACE_API_KEY = os.getenv("HUGGINGFACE_API_KEY")
HUGGINGFACE_MODEL = os.getenv("HUGGINGFACE_MODEL", "mistralai/Mixtral-8x7B-Instruct-v0.1")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    raise RuntimeError("Missing Supabase configuration.")

# Initialize global client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

groq_client = AsyncGroq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None
huggingface_client = InferenceClient(token=HUGGINGFACE_API_KEY) if HUGGINGFACE_API_KEY else None

# --- MODELS ---

class DailyReportRecord(BaseModel):
    id: Optional[str] = None
    report_date: date
    author_name: str
    raw_text: str
    formatted_report: str
    image_url: Optional[str] = None
    created_at: Optional[datetime] = None

class ProjectUpdate(BaseModel):
    project_name: str
    work_notes: str
    image_url: Optional[str] = None

class SubmitReportRequest(BaseModel):
    report_date: Optional[date] = None
    updates: list[ProjectUpdate]

class SubmitReportResponse(BaseModel):
    message: str
    report: DailyReportRecord
    provider: str

class ProfileRecord(BaseModel):
    id: Optional[str] = None
    user_email: str
    full_name: str
    avatar_url: Optional[str] = None
    cover_url: Optional[str] = None
    bio: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    cover_url: Optional[str] = None
    bio: Optional[str] = None

class ReactionRecord(BaseModel):
    id: Optional[str] = None
    post_id: Optional[str] = None
    comment_id: Optional[str] = None
    author_email: str
    emoji: str
    created_at: Optional[datetime] = None

class CommentRecord(BaseModel):
    id: Optional[str] = None
    post_id: str
    author_email: str
    content: str
    created_at: Optional[datetime] = None
    author_name: Optional[str] = None
    author_avatar: Optional[str] = None
    reactions: Optional[list[ReactionRecord]] = []

class PostRecord(BaseModel):
    id: Optional[str] = None
    author_email: str
    content: str
    image_url: Optional[str] = None
    created_at: Optional[datetime] = None
    author_name: Optional[str] = None
    author_avatar: Optional[str] = None
    comments: Optional[list[CommentRecord]] = []
    reactions: Optional[list[ReactionRecord]] = []

class CreatePostRequest(BaseModel):
    content: str
    image_url: Optional[str] = None

class CreateCommentRequest(BaseModel):
    content: str

class CreateReactionRequest(BaseModel):
    emoji: str

# --- AUTH DEPENDENCY ---

security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Any:
    token = credentials.credentials
    try:
        # Use a fresh client or direct HTTP if disconnects persist
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{SUPABASE_URL}/auth/v1/user",
                headers={
                    "Authorization": f"Bearer {token}",
                    "apikey": SUPABASE_SERVICE_ROLE_KEY
                }
            )
            if resp.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid token")
            user_data = resp.json()
            # Wrap in a simple object to mimic Supabase User
            class User:
                def __init__(self, d):
                    self.id = d.get("id")
                    self.email = d.get("email")
                    self.user_metadata = d.get("user_metadata", {})
            return User(user_data)
    except Exception as e:
        logger.error("Auth error: %s", e)
        raise HTTPException(status_code=401, detail=f"Authentication failed: {e}")

# --- APP SETUP ---

app = FastAPI(title="Autolinium API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*", FRONTEND_ORIGIN, "http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- AI HELPERS ---

def build_prompt(updates: list[dict[str, Any]]) -> str:
    prompt = (
        "You are an elite executive assistant preparing a polished daily progress report.\n"
        "Transform the provided structured project updates into a concise, professional, unified report with this structure:\n"
        "1. Executive Summary (1-2 sentences summarizing the overall day)\n"
        "2. Project Updates (Grouped by project name)\n"
        "3. Next actions / Blockers\n\n"
        "Guidelines:\n"
        "- Be punchy, specific, and executive-friendly.\n"
        "- Preserve facts; do not invent milestones.\n"
        "- Use bullets where they improve readability.\n"
        "- CRITICAL: If a project update includes an `Attached Image URL`, you MUST embed it directly in the markdown using the syntax `![Proof of Work](<the_url>)` immediately under that project's section.\n\n"
        "Here are the engineer's raw updates:\n"
    )
    for update in updates:
        prompt += f"\nProject: {update['project_name']}\nNotes: {update['work_notes']}\n"
        if update.get('image_url'):
            prompt += f"Attached Image URL: {update['image_url']}\n"
    return prompt

async def fetch_image_payload(image_url: str) -> Optional[dict[str, Any]]:
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(image_url)
            response.raise_for_status()
        return {"mime_type": response.headers.get("content-type") or "image/jpeg", "data": response.content}
    except Exception: return None

async def try_gemini(updates: list[dict[str, Any]]) -> str:
    if not GEMINI_API_KEY: raise RuntimeError("No Gemini Key")
    model = genai.GenerativeModel(GEMINI_MODEL)
    contents: list[Any] = [build_prompt(updates)]
    for update in updates:
        if update.get('image_url'):
            img = await fetch_image_payload(update['image_url'])
            if img: contents.append(img)
    response = await model.generate_content_async(contents=contents, generation_config={"temperature": 0.3})
    return response.text.strip()

async def try_groq(updates: list[dict[str, Any]]) -> str:
    if not groq_client: raise RuntimeError("No Groq Client")
    completion = await groq_client.chat.completions.create(
        model=GROQ_MODEL, messages=[{"role": "user", "content": build_prompt(updates)}], temperature=0.3
    )
    return completion.choices[0].message.content.strip()

async def generate_report(updates: list[dict[str, Any]]) -> tuple[str, str]:
    for name, call in [("gemini", try_gemini), ("groq", try_groq)]:
        try:
            res = await call(updates)
            if res: return res, name
        except Exception as e: logger.warning("%s failed: %s", name, e)
    raise RuntimeError("AI providers failed")

# --- ROUTES ---

@app.get("/health")
async def health(): return {"status": "ok"}

@app.get("/profiles/me", response_model=ProfileRecord)
async def get_my_profile(user: Any = Depends(get_current_user)):
    resp = await run_in_threadpool(supabase.table("profiles").select("*").eq("user_email", user.email).execute)
    if resp.data: return ProfileRecord(**resp.data[0])
    # Auto-create
    profile = {"user_email": user.email, "full_name": user.user_metadata.get("full_name", user.email)}
    ins = await run_in_threadpool(supabase.table("profiles").insert(profile).execute)
    return ProfileRecord(**ins.data[0])

@app.get("/profiles/all", response_model=list[ProfileRecord])
async def get_all_profiles(user: Any = Depends(get_current_user)):
    resp = await run_in_threadpool(supabase.table("profiles").select("*").execute)
    return [ProfileRecord(**p) for p in resp.data or []]

@app.get("/profiles/fetch/{email}", response_model=ProfileRecord)
async def get_profile_by_email(email: str, user: Any = Depends(get_current_user)):
    resp = await run_in_threadpool(supabase.table("profiles").select("*").eq("user_email", email).execute)
    if not resp.data: raise HTTPException(status_code=404, detail="Not found")
    return ProfileRecord(**resp.data[0])

@app.put("/profiles/me", response_model=ProfileRecord)
async def update_profile_me(update: ProfileUpdate, user: Any = Depends(get_current_user)):
    payload = {k: v for k, v in update.model_dump().items() if v is not None}
    payload["updated_at"] = datetime.now(timezone.utc).isoformat()
    resp = await run_in_threadpool(supabase.table("profiles").update(payload).eq("user_email", user.email).execute)
    return ProfileRecord(**resp.data[0])

@app.get("/reports", response_model=list[DailyReportRecord])
async def get_all_reports(user: Any = Depends(get_current_user)):
    resp = await run_in_threadpool(supabase.table("daily_reports").select("*").order("report_date", desc=True).execute)
    return [DailyReportRecord(**r) for r in resp.data or []]

@app.post("/submit-report", response_model=SubmitReportResponse)
async def submit_new_report(request: SubmitReportRequest, user: Any = Depends(get_current_user)):
    # Get author name from profile
    prof_resp = await run_in_threadpool(supabase.table("profiles").select("full_name").eq("user_email", user.email).execute)
    author_name = prof_resp.data[0]["full_name"] if prof_resp.data else user.email
    
    updates_dicts = [u.model_dump() for u in request.updates]
    formatted, provider = await generate_report(updates_dicts)
    
    import json
    payload = {
        "report_date": (request.report_date or date.today()).isoformat(),
        "author_name": author_name,
        "raw_text": json.dumps(updates_dicts),
        "formatted_report": formatted,
        "image_url": next((u["image_url"] for u in updates_dicts if u["image_url"]), None)
    }
    resp = await run_in_threadpool(supabase.table("daily_reports").insert(payload).execute)
    return SubmitReportResponse(message="Created", report=DailyReportRecord(**resp.data[0]), provider=provider)

@app.get("/posts", response_model=list[PostRecord])
async def get_posts_feed(user: Any = Depends(get_current_user)):
    posts = (await run_in_threadpool(supabase.table("posts").select("*").order("created_at", desc=True).execute)).data or []
    if not posts: return []
    
    p_ids = [p["id"] for p in posts]
    emails = list(set([p["author_email"] for p in posts]))
    
    profiles = {p["user_email"]: p for p in (await run_in_threadpool(supabase.table("profiles").select("*").in_("user_email", emails).execute)).data or []}
    comments = (await run_in_threadpool(supabase.table("comments").select("*").in_("post_id", p_ids).order("created_at").execute)).data or []
    c_ids = [c["id"] for c in comments]
    
    # Reactions
    r_query = supabase.table("reactions").select("*")
    if c_ids: r_query = r_query.or_(f"post_id.in.({','.join(p_ids)}),comment_id.in.({','.join(c_ids)})")
    else: r_query = r_query.in_("post_id", p_ids)
    reactions = (await run_in_threadpool(r_query.execute)).data or []
    
    res = []
    for p in posts:
        rec = PostRecord(**p)
        auth = profiles.get(p["author_email"])
        if auth:
            rec.author_name, rec.author_avatar = auth["full_name"], auth["avatar_url"]
        p_comments = [c for c in comments if c["post_id"] == p["id"]]
        for c in p_comments:
            c_auth = profiles.get(c["author_email"])
            if c_auth:
                c["author_name"], c["author_avatar"] = c_auth["full_name"], c_auth["avatar_url"]
            c["reactions"] = [r for r in reactions if r.get("comment_id") == c["id"]]
        rec.comments = [CommentRecord(**c) for c in p_comments]
        rec.reactions = [ReactionRecord(**r) for r in reactions if r.get("post_id") == p["id"]]
        res.append(rec)
    return res

@app.post("/posts", response_model=PostRecord)
async def create_new_post(req: CreatePostRequest, user: Any = Depends(get_current_user)):
    payload = {"author_email": user.email, "content": req.content, "image_url": req.image_url}
    resp = await run_in_threadpool(supabase.table("posts").insert(payload).execute)
    return PostRecord(**resp.data[0])

@app.delete("/posts/{post_id}")
async def delete_post_by_id(post_id: str, user: Any = Depends(get_current_user)):
    await run_in_threadpool(supabase.table("posts").delete().eq("id", post_id).eq("author_email", user.email).execute)
    return {"status": "ok"}

@app.post("/posts/{post_id}/comments", response_model=CommentRecord)
async def create_new_comment(post_id: str, req: CreateCommentRequest, user: Any = Depends(get_current_user)):
    payload = {"post_id": post_id, "author_email": user.email, "content": req.content}
    resp = await run_in_threadpool(supabase.table("comments").insert(payload).execute)
    return CommentRecord(**resp.data[0])

@app.delete("/comments/{comment_id}")
async def delete_comment_by_id(comment_id: str, user: Any = Depends(get_current_user)):
    await run_in_threadpool(supabase.table("comments").delete().eq("id", comment_id).eq("author_email", user.email).execute)
    return {"status": "ok"}

@app.post("/posts/{post_id}/reactions", response_model=ReactionRecord)
async def post_reaction(post_id: str, req: CreateReactionRequest, user: Any = Depends(get_current_user)):
    existing = await run_in_threadpool(supabase.table("reactions").select("*").eq("post_id", post_id).eq("author_email", user.email).eq("emoji", req.emoji).execute)
    if existing.data:
        await run_in_threadpool(supabase.table("reactions").delete().eq("id", existing.data[0]["id"]).execute)
        return ReactionRecord(**existing.data[0])
    resp = await run_in_threadpool(supabase.table("reactions").insert({"post_id": post_id, "author_email": user.email, "emoji": req.emoji}).execute)
    return ReactionRecord(**resp.data[0])

@app.post("/comments/{comment_id}/reactions", response_model=ReactionRecord)
async def comment_reaction(comment_id: str, req: CreateReactionRequest, user: Any = Depends(get_current_user)):
    existing = await run_in_threadpool(supabase.table("reactions").select("*").eq("comment_id", comment_id).eq("author_email", user.email).eq("emoji", req.emoji).execute)
    if existing.data:
        await run_in_threadpool(supabase.table("reactions").delete().eq("id", existing.data[0]["id"]).execute)
        return ReactionRecord(**existing.data[0])
    resp = await run_in_threadpool(supabase.table("reactions").insert({"comment_id": comment_id, "author_email": user.email, "emoji": req.emoji}).execute)
    return ReactionRecord(**resp.data[0])
