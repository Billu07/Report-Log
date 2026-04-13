import os
import logging
import httpx
import json
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Optional
from uuid import uuid4

import google.generativeai as genai
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Depends, APIRouter, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from supabase import create_client, Client
from groq import AsyncGroq
from starlette.concurrency import run_in_threadpool

# Load env
load_dotenv()

# Logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("autolinium-api")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "*")
CEO_EMAIL = os.getenv("CEO_EMAIL", "").lower()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-pro")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

# Validate required envs
if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    logger.error("CRITICAL: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing!")

# Initialize global client
try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
except Exception as e:
    logger.error("Failed to initialize Supabase client: %s", e)
    supabase = None

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

groq_client = AsyncGroq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None

# --- MODELS ---

class ProfileRecord(BaseModel):
    id: Optional[str] = None
    user_email: str
    full_name: str
    avatar_url: Optional[str] = None
    cover_url: Optional[str] = None
    bio: Optional[str] = None

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

class ProjectUpdate(BaseModel):
    project_name: str
    work_notes: str
    next_steps: Optional[str] = None
    blockers: Optional[str] = None
    image_url: Optional[str] = None

class DailyReportRecord(BaseModel):
    id: Optional[str] = None
    report_date: date
    author_name: str
    author_email: Optional[str] = None
    raw_text: str
    formatted_report: str
    image_url: Optional[str] = None
    created_at: Optional[datetime] = None

class SubmitReportRequest(BaseModel):
    report_date: Optional[date] = None
    updates: list[ProjectUpdate]

class SubmitReportResponse(BaseModel):
    message: str
    report: DailyReportRecord
    provider: str

class CommentRecord(BaseModel):
    id: Optional[str] = None
    post_id: str
    author_email: str
    content: str
    created_at: Optional[datetime] = None
    author_name: Optional[str] = None
    author_avatar: Optional[str] = None
    reactions: list[ReactionRecord] = []

class PostRecord(BaseModel):
    id: Optional[str] = None
    author_email: str
    content: str
    image_url: Optional[str] = None
    created_at: Optional[datetime] = None
    author_name: Optional[str] = None
    author_avatar: Optional[str] = None
    comments: list[CommentRecord] = []
    reactions: list[ReactionRecord] = []

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
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase not initialized")
    
    token = credentials.credentials
    try:
        # Verify with Supabase
        user_resp = await run_in_threadpool(supabase.auth.get_user, token)
        if user_resp.user:
            class User:
                def __init__(self, d):
                    self.id = d.get("id")
                    self.email = d.get("email")
                    self.user_metadata = d.get("user_metadata", {})
            return User(user_resp.user.__dict__)
        else:
            raise HTTPException(status_code=401, detail="User not found in Supabase")
    except Exception as e:
        logger.error("Auth error: %s", e)
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")

# --- APP SETUP ---

app = FastAPI(
    title="Autolinium API", 
    version="1.0.0",
    root_path="/api/backend"
)

# Global error handler to catch 500s and log them
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception: %s", exc, exc_info=True)
    return HTTPException(status_code=500, detail=str(exc))

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- AI HELPERS ---

def build_prompt(updates: list[dict[str, Any]]) -> str:
    prompt = (
        "You are an elite executive assistant preparing a polished daily progress report for an individual contributor.\n"
        "Transform the provided project updates into a concise, professional report that reflects the individual's personal execution.\n"
        "1. Executive Summary (A one-sentence impact statement of YOUR achievements today)\n"
        "2. Project Execution (Grouped by project name)\n"
        "   - Status: Current individual progress\n"
        "   - Key Achievements: Bullet points of work YOU completed\n"
        "   - Next Steps: Your planned actions (Only if provided)\n"
        "   - Blockers: Your impediments (Only if provided)\n\n"
        "Guidelines:\n"
        "- Perspective: Use the first person ('I', 'My', 'Me') exclusively. DO NOT use 'the team', 'we', or 'our'.\n"
        "- Tone: Technical, precise, and authoritative. Avoid fluff.\n"
        "- Standard: Industry-standard professional terminology.\n"
        "- Constraint: DO NOT invent milestones or next steps. If next steps/blockers are empty, do not create them.\n"
        "- CRITICAL: If an `Attached Image URL` is provided, embed it using `![Proof of Work](<the_url>)` at the end of that project's section.\n\n"
        "Here are your raw updates:\n"
    )
    for update in updates:
        prompt += f"\nProject: {update['project_name']}\n"
        prompt += f"Execution Notes: {update['work_notes']}\n"
        if update.get('next_steps'):
            prompt += f"Proposed Next Steps: {update['next_steps']}\n"
        if update.get('blockers'):
            prompt += f"Current Blockers: {update['blockers']}\n"
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
    # Fallback to simple formatting
    lines = ["# Daily Briefing Executive Summary", "Successful execution across all active projects."]
    for u in updates:
        lines.append(f"\n## {u['project_name']}")
        lines.append(f"- {u['work_notes']}")
        if u.get('image_url'):
            lines.append(f"![Proof of Work]({u['image_url']})")
    return "\n".join(lines), "fallback"

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
    query = supabase.table("daily_reports").select("*")
    if user.email.lower() != CEO_EMAIL:
        query = query.eq("author_email", user.email)
    resp = await run_in_threadpool(query.order("report_date", desc=True).execute)
    return [DailyReportRecord(**r) for r in resp.data or []]

@app.post("/submit-report", response_model=SubmitReportResponse)
async def submit_new_report(request: SubmitReportRequest, user: Any = Depends(get_current_user)):
    prof_resp = await run_in_threadpool(supabase.table("profiles").select("full_name").eq("user_email", user.email).execute)
    author_name = prof_resp.data[0]["full_name"] if prof_resp.data else user.email
    updates_dicts = [u.model_dump() for u in request.updates]
    formatted, provider = await generate_report(updates_dicts)
    
    payload = {
        "report_date": (request.report_date or date.today()).isoformat(),
        "author_name": author_name,
        "author_email": user.email,
        "raw_text": json.dumps(updates_dicts),
        "formatted_report": formatted,
        "image_url": next((u["image_url"] for u in updates_dicts if u["image_url"]), None)
    }
    resp = await run_in_threadpool(supabase.table("daily_reports").insert(payload).execute)
    return SubmitReportResponse(message="Created", report=DailyReportRecord(**resp.data[0]), provider=provider)

@app.get("/posts", response_model=list[PostRecord])
async def get_posts_feed(user: Any = Depends(get_current_user)):
    posts_resp = await run_in_threadpool(supabase.table("posts").select("*").order("created_at", desc=True).execute)
    posts = posts_resp.data or []
    if not posts: return []
    
    p_ids = [p["id"] for p in posts]
    emails = list(set([p["author_email"] for p in posts]))
    
    prof_resp = await run_in_threadpool(supabase.table("profiles").select("*").in_("user_email", emails).execute)
    profiles_map = {p["user_email"]: p for p in prof_resp.data or []}
    
    comm_resp = await run_in_threadpool(supabase.table("comments").select("*").in_("post_id", p_ids).order("created_at").execute)
    comments = comm_resp.data or []
    c_ids = [c["id"] for c in comments]
    
    r_query = supabase.table("reactions").select("*")
    if c_ids: r_query = r_query.or_(f"post_id.in.({','.join(p_ids)}),comment_id.in.({','.join(c_ids)})")
    else: r_query = r_query.in_("post_id", p_ids)
    
    react_resp = await run_in_threadpool(r_query.execute)
    reactions = react_resp.data or []
    
    res = []
    for p in posts:
        rec = PostRecord(**p)
        auth = profiles_map.get(p["author_email"])
        if auth: rec.author_name, rec.author_avatar = auth["full_name"], auth["avatar_url"]
        p_comments = [c for c in comments if c["post_id"] == p["id"]]
        for c in p_comments:
            c_auth = profiles_map.get(c["author_email"])
            if c_auth: c["author_name"], c["author_avatar"] = c_auth["full_name"], c_auth["avatar_url"]
            c["reactions"] = [r for r in reactions if r.get("comment_id") == c["id"]]
        rec.comments = [CommentRecord(**c) for c in p_comments]
        rec.reactions = [ReactionRecord(**r) for r in reactions if r.get("post_id") == p["id"]]
        res.append(rec)
    return res

@app.post("/posts", response_model=PostRecord)
async def create_new_post(req: CreatePostRequest, user: Any = Depends(get_current_user)):
    resp = await run_in_threadpool(supabase.table("posts").insert({"author_email": user.email, "content": req.content, "image_url": req.image_url}).execute)
    return PostRecord(**resp.data[0])

@app.delete("/posts/{post_id}")
async def delete_post_by_id(post_id: str, user: Any = Depends(get_current_user)):
    await run_in_threadpool(supabase.table("posts").delete().eq("id", post_id).eq("author_email", user.email).execute)
    return {"status": "ok"}

@app.post("/posts/{post_id}/comments", response_model=CommentRecord)
async def create_new_comment(post_id: str, req: CreateCommentRequest, user: Any = Depends(get_current_user)):
    resp = await run_in_threadpool(supabase.table("comments").insert({"post_id": post_id, "author_email": user.email, "content": req.content}).execute)
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
