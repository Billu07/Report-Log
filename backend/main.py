import asyncio
import logging
import mimetypes
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

import os


# Load backend-local secrets first, then allow a parent/root `.env` to fill gaps.
load_dotenv(Path(__file__).with_name(".env"))
load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("daily-report-api")


def require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


SUPABASE_URL = require_env("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = require_env("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_REPORTS_BUCKET = os.getenv("SUPABASE_REPORTS_BUCKET", "daily-report-images")
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-pro")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
HUGGINGFACE_API_KEY = os.getenv("HUGGINGFACE_API_KEY")
HUGGINGFACE_MODEL = os.getenv(
    "HUGGINGFACE_MODEL", "mistralai/Mixtral-8x7B-Instruct-v0.1"
)


# The service-role key is used here because the API needs write access to both
# Postgres rows and Storage objects.
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

groq_client = AsyncGroq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None
huggingface_client = (
    InferenceClient(token=HUGGINGFACE_API_KEY) if HUGGINGFACE_API_KEY else None
)

# The API is intentionally small: one ingestion endpoint, one fetch endpoint,
# plus a health check that is useful for deployment and uptime monitoring.
app = FastAPI(
    title="Daily Report Automation API",
    description="Formats raw work notes into polished daily reports with AI fallbacks.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN, "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Any:
    token = credentials.credentials
    try:
        user_response = supabase.auth.get_user(token)
        if not user_response.user:
            logger.error("Auth failed: No user in response for token. Response: %s", user_response)
            raise HTTPException(status_code=401, detail="Invalid or expired token.")
        return user_response.user
    except Exception as e:
        logger.error("Auth exception: %s", e)
        raise HTTPException(status_code=401, detail=f"Authentication failed: {e}")


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
    provider: str = Field(..., description="The AI provider that produced the report.")


# --- SOCIAL MODELS ---

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
    post_id: str
    author_email: str
    emoji: str
    created_at: Optional[datetime] = None

class CommentRecord(BaseModel):
    id: Optional[str] = None
    post_id: str
    author_email: str
    content: str
    created_at: Optional[datetime] = None
    # Joined profile data
    author_name: Optional[str] = None
    author_avatar: Optional[str] = None
    reactions: Optional[list[ReactionRecord]] = []

class PostRecord(BaseModel):
    id: Optional[str] = None
    author_email: str
    content: str
    image_url: Optional[str] = None
    created_at: Optional[datetime] = None
    # Joined profile data
    author_name: Optional[str] = None
    author_avatar: Optional[str] = None
    # Stats
    comments: Optional[list[CommentRecord]] = []
    reactions: Optional[list[ReactionRecord]] = []

class CreatePostRequest(BaseModel):
    content: str
    image_url: Optional[str] = None

class CreateCommentRequest(BaseModel):
    content: str

class CreateReactionRequest(BaseModel):
    emoji: str

# --- END SOCIAL MODELS ---

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
    """
    Gemini's legacy SDK accepts binary image data, not a remote URL.
    We download the public asset and pass it in-line.
    """
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.get(image_url)
            response.raise_for_status()

        content_type = response.headers.get("content-type") or mimetypes.guess_type(
            image_url
        )[0]
        return {
            "mime_type": content_type or "image/jpeg",
            "data": response.content,
        }
    except Exception as exc:  # pragma: no cover
        logger.warning("Unable to fetch image for Gemini multimodal prompt: %s", exc)
        return None


async def try_gemini(updates: list[dict[str, Any]]) -> str:
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not configured.")

    prompt = build_prompt(updates)
    model = genai.GenerativeModel(GEMINI_MODEL)

    contents: list[Any] = [prompt]
    for update in updates:
        if update.get('image_url'):
            image_payload = await fetch_image_payload(update['image_url'])
            if image_payload:
                contents.append(image_payload)

    response = await model.generate_content_async(
        contents=contents,
        generation_config={"temperature": 0.3},
    )

    if not getattr(response, "text", "").strip():
        raise RuntimeError("Gemini returned an empty report.")
    return response.text.strip()


async def try_groq(updates: list[dict[str, Any]]) -> str:
    if not groq_client:
        raise RuntimeError("GROQ_API_KEY is not configured.")

    completion = await groq_client.chat.completions.create(
        model=GROQ_MODEL,
        temperature=0.3,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are an elite executive assistant who rewrites rough work notes "
                    "into professional daily reports for leadership."
                ),
            },
            {
                "role": "user",
                "content": build_prompt(updates),
            },
        ],
    )

    content = completion.choices[0].message.content if completion.choices else None
    if not content:
        raise RuntimeError("Groq returned an empty report.")
    return content.strip()


def _run_huggingface_completion(prompt: str) -> str:
    if not huggingface_client:
        raise RuntimeError("HUGGINGFACE_API_KEY is not configured.")

    response = huggingface_client.chat_completion(
        model=HUGGINGFACE_MODEL,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are an elite executive assistant who formats rough work notes "
                    "into crisp professional daily reports."
                ),
            },
            {"role": "user", "content": prompt},
        ],
        max_tokens=700,
        temperature=0.3,
    )

    content = response.choices[0].message.content if response.choices else None
    if not content:
        raise RuntimeError("Hugging Face returned an empty report.")
    return content.strip()


async def try_huggingface(updates: list[dict[str, Any]]) -> str:
    prompt = build_prompt(updates)
    return await asyncio.to_thread(_run_huggingface_completion, prompt)


async def generate_report(
    updates: list[dict[str, Any]]
) -> tuple[str, str]:
    """
    Returns a tuple of (formatted_report, provider_name).
    The function walks the fallback chain in order until one provider succeeds.
    """
    last_error: Optional[Exception] = None

    for provider_name, provider_call in (
        ("gemini", try_gemini),
        ("groq", try_groq),
        ("huggingface", try_huggingface),
    ):
        try:
            formatted_report = await provider_call(updates=updates)
            logger.info("Report generated with %s", provider_name)
            return formatted_report, provider_name
        except Exception as exc:
            last_error = exc
            logger.exception("%s report generation failed", provider_name)

    raise RuntimeError(
        f"All AI providers failed to generate a report. Last error: {last_error}"
    )


@app.get("/health")
async def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/submit-report", response_model=SubmitReportResponse)
async def submit_report(
    request: SubmitReportRequest,
    user: Any = Depends(get_current_user)
) -> SubmitReportResponse:
    """
    Accepts a structured JSON payload of project updates, generates a polished report,
    and persists it to the `daily_reports` table in Supabase.
    """
    email = user.email
    full_name = user.user_metadata.get("full_name", email)
    profile = await get_or_create_profile(email, full_name)
    author_name = profile.get("full_name", email)
    
    updates_dicts = [u.model_dump() for u in request.updates]

    try:
        formatted_report, provider = await generate_report(updates_dicts)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Report generation failed across all providers: {exc}",
        ) from exc

    import json
    raw_text = json.dumps(updates_dicts, indent=2)
    cover_image_url = next((u["image_url"] for u in updates_dicts if u["image_url"]), None)

    payload = {
        "report_date": (request.report_date or date.today()).isoformat(),
        "author_name": author_name,
        "raw_text": raw_text,
        "formatted_report": formatted_report,
        "image_url": cover_image_url,
    }

    insert_response = await run_in_threadpool(
        supabase.table("daily_reports").insert(payload).execute
    )

    if not insert_response.data:
        raise HTTPException(status_code=500, detail="Supabase insert returned no data.")

    report = DailyReportRecord.model_validate(insert_response.data[0])
    return SubmitReportResponse(
        message="Daily report created successfully.",
        report=report,
        provider=provider,
    )


@app.get("/reports", response_model=list[DailyReportRecord])
async def get_reports(user: Any = Depends(get_current_user)) -> list[DailyReportRecord]:
    """
    Returns all reports sorted newest-first so the calendar can map them by day.
    """
    response = await run_in_threadpool(
        supabase.table("daily_reports")
        .select("*")
        .order("report_date", desc=True)
        .order("created_at", desc=True)
        .execute
    )
    return [DailyReportRecord.model_validate(item) for item in response.data or []]


# --- SOCIAL API ROUTES ---

async def get_or_create_profile(email: str, full_name: str) -> dict[str, Any]:
    response = await run_in_threadpool(
        supabase.table("profiles").select("*").eq("user_email", email).execute
    )
    if response.data:
        return response.data[0]
    
    # Create
    payload = {"user_email": email, "full_name": full_name}
    insert_resp = await run_in_threadpool(
        supabase.table("profiles").insert(payload).execute
    )
    return insert_resp.data[0]


@app.get("/profiles/me", response_model=ProfileRecord)
async def get_my_profile(user: Any = Depends(get_current_user)) -> ProfileRecord:
    email = user.email
    full_name = user.user_metadata.get("full_name", email)
    profile = await get_or_create_profile(email, full_name)
    return ProfileRecord(**profile)


@app.get("/profiles/{email}", response_model=ProfileRecord)
async def get_profile(email: str, user: Any = Depends(get_current_user)) -> ProfileRecord:
    response = await run_in_threadpool(
        supabase.table("profiles").select("*").eq("user_email", email).execute
    )
    if not response.data:
        raise HTTPException(status_code=404, detail="Profile not found")
    return ProfileRecord(**response.data[0])


@app.put("/profiles/me", response_model=ProfileRecord)
async def update_my_profile(
    update: ProfileUpdate, 
    user: Any = Depends(get_current_user)
) -> ProfileRecord:
    email = user.email
    full_name = user.user_metadata.get("full_name", email)
    profile = await get_or_create_profile(email, full_name)
    
    payload = {k: v for k, v in update.model_dump().items() if v is not None}
    payload["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    update_resp = await run_in_threadpool(
        supabase.table("profiles").update(payload).eq("user_email", email).execute
    )
    return ProfileRecord(**update_resp.data[0])


@app.get("/posts", response_model=list[PostRecord])
async def get_feed(user: Any = Depends(get_current_user)) -> list[PostRecord]:
    # Fetch posts
    posts_resp = await run_in_threadpool(
        supabase.table("posts").select("*").order("created_at", desc=True).execute
    )
    posts = posts_resp.data or []
    
    if not posts:
        return []
    
    post_ids = [p["id"] for p in posts]
    author_emails = list(set([p["author_email"] for p in posts]))
    
    # Fetch profiles for authors
    profiles_resp = await run_in_threadpool(
        supabase.table("profiles").select("user_email, full_name, avatar_url").in_("user_email", author_emails).execute
    )
    profiles = {p["user_email"]: p for p in profiles_resp.data or []}
    
    # Fetch comments
    comments_resp = await run_in_threadpool(
        supabase.table("comments").select("*").in_("post_id", post_ids).order("created_at", desc=False).execute
    )
    comments = comments_resp.data or []
    
    # Fetch reactions
    reactions_resp = await run_in_threadpool(
        supabase.table("reactions").select("*").in_("post_id", post_ids).execute
    )
    reactions = reactions_resp.data or []
    
    # Assemble
    result = []
    for p in posts:
        record = PostRecord(**p)
        author = profiles.get(p["author_email"])
        if author:
            record.author_name = author["full_name"]
            record.author_avatar = author["avatar_url"]
            
        # Add comments
        post_comments = [c for c in comments if c["post_id"] == p["id"]]
        for c in post_comments:
            c_author = profiles.get(c["author_email"])
            if c_author:
                c["author_name"] = c_author["full_name"]
                c["author_avatar"] = c_author["avatar_url"]
            # Add comment reactions
            c["reactions"] = [r for r in reactions if r.get("comment_id") == c["id"]]
        record.comments = [CommentRecord(**c) for c in post_comments]
        
        # Add reactions
        record.reactions = [ReactionRecord(**r) for r in reactions if r["post_id"] == p["id"]]
        
        result.append(record)
        
    return result


@app.post("/posts", response_model=PostRecord)
async def create_post(
    req: CreatePostRequest, 
    user: Any = Depends(get_current_user)
) -> PostRecord:
    email = user.email
    full_name = user.user_metadata.get("full_name", email)
    await get_or_create_profile(email, full_name)
    
    payload = {
        "author_email": email,
        "content": req.content,
        "image_url": req.image_url
    }
    
    insert_resp = await run_in_threadpool(
        supabase.table("posts").insert(payload).execute
    )
    
    post = insert_resp.data[0]
    record = PostRecord(**post)
    return record


@app.post("/posts/{post_id}/comments", response_model=CommentRecord)
async def create_comment(
    post_id: str,
    req: CreateCommentRequest,
    user: Any = Depends(get_current_user)
) -> CommentRecord:
    email = user.email
    full_name = user.user_metadata.get("full_name", email)
    await get_or_create_profile(email, full_name)
    
    payload = {
        "post_id": post_id,
        "author_email": email,
        "content": req.content
    }
    
    insert_resp = await run_in_threadpool(
        supabase.table("comments").insert(payload).execute
    )
    return CommentRecord(**insert_resp.data[0])


@app.post("/posts/{post_id}/reactions", response_model=ReactionRecord)
async def toggle_post_reaction(
    post_id: str,
    req: CreateReactionRequest,
    user: Any = Depends(get_current_user)
) -> ReactionRecord:
    email = user.email
    # Check if exists
    existing = await run_in_threadpool(
        supabase.table("reactions")
        .select("*")
        .eq("post_id", post_id)
        .eq("author_email", email)
        .eq("emoji", req.emoji)
        .execute
    )
    if existing.data:
        await run_in_threadpool(supabase.table("reactions").delete().eq("id", existing.data[0]["id"]).execute)
        return ReactionRecord(**existing.data[0])
    payload = {"post_id": post_id, "author_email": email, "emoji": req.emoji}
    insert_resp = await run_in_threadpool(supabase.table("reactions").insert(payload).execute)
    return ReactionRecord(**insert_resp.data[0])

@app.post("/comments/{comment_id}/reactions", response_model=ReactionRecord)
async def toggle_comment_reaction(
    comment_id: str,
    req: CreateReactionRequest,
    user: Any = Depends(get_current_user)
) -> ReactionRecord:
    email = user.email
    existing = await run_in_threadpool(
        supabase.table("reactions")
        .select("*")
        .eq("comment_id", comment_id)
        .eq("author_email", email)
        .eq("emoji", req.emoji)
        .execute
    )
    if existing.data:
        await run_in_threadpool(supabase.table("reactions").delete().eq("id", existing.data[0]["id"]).execute)
        return ReactionRecord(**existing.data[0])
    payload = {"comment_id": comment_id, "author_email": email, "emoji": req.emoji}
    insert_resp = await run_in_threadpool(supabase.table("reactions").insert(payload).execute)
    return ReactionRecord(**insert_resp.data[0])

@app.delete("/posts/{post_id}")
async def delete_post(post_id: str, user: Any = Depends(get_current_user)):
    # Verify ownership
    existing = await run_in_threadpool(supabase.table("posts").select("author_email").eq("id", post_id).execute)
    if not existing.data or existing.data[0]["author_email"] != user.email:
        raise HTTPException(status_code=403, detail="Not authorized to delete this post")
    await run_in_threadpool(supabase.table("posts").delete().eq("id", post_id).execute)
    return {"status": "ok"}

@app.delete("/comments/{comment_id}")
async def delete_comment(comment_id: str, user: Any = Depends(get_current_user)):
    existing = await run_in_threadpool(supabase.table("comments").select("author_email").eq("id", comment_id).execute)
    if not existing.data or existing.data[0]["author_email"] != user.email:
        raise HTTPException(status_code=403, detail="Not authorized to delete this comment")
    await run_in_threadpool(supabase.table("comments").delete().eq("id", comment_id).execute)
    return {"status": "ok"}

@app.get("/profiles/all", response_model=list[ProfileRecord])
async def get_all_profiles(user: Any = Depends(get_current_user)) -> list[ProfileRecord]:
    response = await run_in_threadpool(supabase.table("profiles").select("*").execute())
    return [ProfileRecord(**p) for p in response.data or []]
