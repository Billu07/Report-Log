import os
import logging
import httpx
import json
import re
from datetime import date, datetime, timezone, timedelta
from pathlib import Path
from typing import Any, Optional
from uuid import uuid4

import google.generativeai as genai
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
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
def parse_email_list(raw_value: str) -> set[str]:
    return {value.strip().lower() for value in (raw_value or "").split(",") if value.strip()}

CEO_EMAILS = parse_email_list(os.getenv("CEO_EMAILS", ""))
legacy_ceo_email = (os.getenv("CEO_EMAIL", "") or "").strip().lower()
if legacy_ceo_email:
    CEO_EMAILS.add(legacy_ceo_email)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.1-pro-preview")
GEMINI_FALLBACK_MODEL = os.getenv("GEMINI_FALLBACK_MODEL", "gemini-2.5-pro")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
GROQ_FALLBACK_MODEL = os.getenv("GROQ_FALLBACK_MODEL", "llama-3.3-70b-versatile")

# --- SUPABASE CLIENT ---
def get_supabase() -> Client:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise RuntimeError("Missing Supabase configuration")
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

try:
    supabase = get_supabase()
except Exception as e:
    logger.error("Supabase init failed: %s", e)
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
    completion_percent: Optional[int] = Field(default=None, ge=0, le=100)

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

class OptimizeUpdatesRequest(BaseModel):
    updates: list[ProjectUpdate]
    style: Optional[str] = "executive"

class OptimizeUpdatesResponse(BaseModel):
    message: str
    provider: str
    updates: list[ProjectUpdate]
    preview: str

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

class NotificationRecord(BaseModel):
    id: str
    type: str
    created_at: datetime
    actor_email: Optional[str] = None
    actor_name: Optional[str] = None
    actor_avatar: Optional[str] = None
    post_id: Optional[str] = None
    comment_id: Optional[str] = None
    title: str
    body: str

# --- AUTH DEPENDENCY ---

security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Any:
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase not initialized")
    token = credentials.credentials
    try:
        user_resp = await run_in_threadpool(supabase.auth.get_user, token)
        if user_resp.user:
            return user_resp.user
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        logger.error("Auth error: %s", e)
        raise HTTPException(status_code=401, detail=str(e))

# --- APP SETUP ---

app = FastAPI(title="Autolinium API")

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
    contents: list[Any] = [build_prompt(updates)]
    for update in updates:
        if update.get('image_url'):
            img = await fetch_image_payload(update['image_url'])
            if img: contents.append(img)
    model_candidates = [GEMINI_MODEL, GEMINI_FALLBACK_MODEL]
    for model_name in model_candidates:
        if not model_name:
            continue
        try:
            model = genai.GenerativeModel(model_name)
            response = await model.generate_content_async(contents=contents, generation_config={"temperature": 0.3})
            if response.text:
                return response.text.strip()
        except Exception as e:
            logger.warning("Gemini model %s failed: %s", model_name, e)
    raise RuntimeError("All Gemini models failed")

async def try_groq(updates: list[dict[str, Any]]) -> str:
    if not groq_client: raise RuntimeError("No Groq Client")
    model_candidates = [GROQ_MODEL, GROQ_FALLBACK_MODEL]
    for model_name in model_candidates:
        if not model_name:
            continue
        try:
            completion = await groq_client.chat.completions.create(
                model=model_name, messages=[{"role": "user", "content": build_prompt(updates)}], temperature=0.3
            )
            content = completion.choices[0].message.content
            if content:
                return content.strip()
        except Exception as e:
            logger.warning("Groq model %s failed: %s", model_name, e)
    raise RuntimeError("All Groq models failed")

async def generate_report(updates: list[dict[str, Any]]) -> tuple[str, str]:
    def clean_text(value: Any) -> str:
        return " ".join(str(value or "").split())

    def normalize_completion_percent(value: Any) -> Optional[int]:
        if value in (None, "") or isinstance(value, bool):
            return None
        try:
            parsed = int(round(float(str(value).replace("%", "").strip())))
        except Exception:
            return None
        return max(0, min(100, parsed))

    lines = [
        "# Daily Briefing",
        "_Factual mode: this report uses submitted notes only and does not infer new work._",
    ]
    for index, update in enumerate(updates, start=1):
        project_name = clean_text(update.get("project_name")) or f"Project {index}"
        work_notes = clean_text(update.get("work_notes")) or "No execution notes submitted."
        next_steps = clean_text(update.get("next_steps"))
        blockers = clean_text(update.get("blockers"))
        image_url = clean_text(update.get("image_url"))
        completion_percent = normalize_completion_percent(update.get("completion_percent"))

        lines.append(f"\n## {index}. {project_name}")
        lines.append(f"- **Execution Notes:** {work_notes}")
        if completion_percent is not None:
            lines.append(f"- **Completion:** {completion_percent}%")
        if next_steps:
            lines.append(f"- **Next Steps:** {next_steps}")
        if blockers:
            lines.append(f"- **Blockers:** {blockers}")
        if image_url:
            lines.append(f"![Proof of Work]({image_url})")

    return "\n".join(lines), "factual-formatter"

def build_optimize_prompt(updates: list[dict[str, Any]], style: str) -> str:
    serialized = json.dumps(
        [
            {
                "project_name": u.get("project_name", ""),
                "work_notes": u.get("work_notes", ""),
                "next_steps": u.get("next_steps"),
                "blockers": u.get("blockers"),
                "image_url": u.get("image_url"),
                "completion_percent": u.get("completion_percent"),
            }
            for u in updates
        ],
        ensure_ascii=False,
    )
    return (
        "You are a technical writing copilot for an automation agency.\n"
        f"Rewrite these update entries in a {style} style while preserving meaning and factual details.\n"
        "Rules:\n"
        "- Keep perspective in first person where suitable.\n"
        "- Do not invent work, blockers, or next steps.\n"
        "- Keep completion_percent unchanged when provided.\n"
        "- Keep project_name unchanged unless grammar fixes are needed.\n"
        "- Keep image_url exactly as provided.\n"
        "- Return strict JSON array only, no markdown fences, with objects in this shape:\n"
        "  {\"project_name\": string, \"work_notes\": string, \"next_steps\": string|null, \"blockers\": string|null, \"image_url\": string|null, \"completion_percent\": number|null}\n\n"
        f"Input updates JSON:\n{serialized}"
    )

def extract_json_array_block(text: str) -> Optional[list[Any]]:
    if not text:
        return None

    code_block_match = re.search(r"```(?:json)?\s*(\[[\s\S]*?\])\s*```", text, flags=re.IGNORECASE)
    candidate = code_block_match.group(1) if code_block_match else text

    first_idx = candidate.find("[")
    last_idx = candidate.rfind("]")
    if first_idx == -1 or last_idx == -1 or last_idx <= first_idx:
        return None

    raw_json = candidate[first_idx:last_idx + 1]
    try:
        parsed = json.loads(raw_json)
        if isinstance(parsed, list):
            return parsed
    except Exception:
        return None
    return None

def normalize_optimized_updates(
    original_updates: list[dict[str, Any]], candidate_updates: list[Any]
) -> list[dict[str, Any]]:
    def normalize_completion_percent(value: Any) -> Optional[int]:
        if value in (None, "") or isinstance(value, bool):
            return None
        try:
            parsed = int(round(float(str(value).replace("%", "").strip())))
        except Exception:
            return None
        return max(0, min(100, parsed))

    normalized: list[dict[str, Any]] = []
    for idx, original in enumerate(original_updates):
        candidate = candidate_updates[idx] if idx < len(candidate_updates) and isinstance(candidate_updates[idx], dict) else {}
        project_name = str(candidate.get("project_name") or original.get("project_name") or "").strip()
        work_notes = str(candidate.get("work_notes") or original.get("work_notes") or "").strip()
        next_steps_raw = candidate.get("next_steps")
        blockers_raw = candidate.get("blockers")
        image_url_raw = candidate.get("image_url")
        completion_candidate = normalize_completion_percent(candidate.get("completion_percent"))
        completion_original = normalize_completion_percent(original.get("completion_percent"))

        next_steps = (str(next_steps_raw).strip() if next_steps_raw not in (None, "") else None)
        blockers = (str(blockers_raw).strip() if blockers_raw not in (None, "") else None)
        image_url = (str(image_url_raw).strip() if image_url_raw not in (None, "") else None)

        normalized.append(
            {
                "project_name": project_name or str(original.get("project_name") or "").strip(),
                "work_notes": work_notes or str(original.get("work_notes") or "").strip(),
                "next_steps": next_steps if next_steps is not None else original.get("next_steps"),
                "blockers": blockers if blockers is not None else original.get("blockers"),
                "image_url": image_url if image_url is not None else original.get("image_url"),
                "completion_percent": completion_candidate if completion_candidate is not None else completion_original,
            }
        )
    return normalized

def build_preview_line(updates: list[dict[str, Any]]) -> str:
    first_project = next((u.get("project_name") for u in updates if u.get("project_name")), "latest priorities")
    blockers = sum(1 for u in updates if u.get("blockers"))
    next_steps = sum(1 for u in updates if u.get("next_steps"))
    return f"Refined {len(updates)} project updates around {first_project} with {next_steps} next-step cues and {blockers} blockers captured."

async def try_gemini_optimize(updates: list[dict[str, Any]], style: str) -> list[dict[str, Any]]:
    if not GEMINI_API_KEY:
        raise RuntimeError("No Gemini Key")
    prompt = build_optimize_prompt(updates, style)
    model_candidates = [GEMINI_MODEL, GEMINI_FALLBACK_MODEL]
    for model_name in model_candidates:
        if not model_name:
            continue
        try:
            model = genai.GenerativeModel(model_name)
            response = await model.generate_content_async(
                contents=[prompt],
                generation_config={"temperature": 0.2},
            )
            candidate = extract_json_array_block(response.text or "")
            if candidate is not None:
                return normalize_optimized_updates(updates, candidate)
        except Exception as e:
            logger.warning("Gemini optimize model %s failed: %s", model_name, e)
    raise RuntimeError("All Gemini optimize models failed")

async def try_groq_optimize(updates: list[dict[str, Any]], style: str) -> list[dict[str, Any]]:
    if not groq_client:
        raise RuntimeError("No Groq Client")
    prompt = build_optimize_prompt(updates, style)
    model_candidates = [GROQ_MODEL, GROQ_FALLBACK_MODEL]
    for model_name in model_candidates:
        if not model_name:
            continue
        try:
            completion = await groq_client.chat.completions.create(
                model=model_name,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2,
            )
            content = completion.choices[0].message.content or ""
            candidate = extract_json_array_block(content)
            if candidate is not None:
                return normalize_optimized_updates(updates, candidate)
        except Exception as e:
            logger.warning("Groq optimize model %s failed: %s", model_name, e)
    raise RuntimeError("All Groq optimize models failed")

def fallback_optimize_updates(updates: list[dict[str, Any]]) -> list[dict[str, Any]]:
    def normalize_completion_percent(value: Any) -> Optional[int]:
        if value in (None, "") or isinstance(value, bool):
            return None
        try:
            parsed = int(round(float(str(value).replace("%", "").strip())))
        except Exception:
            return None
        return max(0, min(100, parsed))

    fallback: list[dict[str, Any]] = []
    for update in updates:
        work_notes = " ".join(str(update.get("work_notes") or "").split())
        next_steps = " ".join(str(update.get("next_steps") or "").split()) if update.get("next_steps") else None
        blockers = " ".join(str(update.get("blockers") or "").split()) if update.get("blockers") else None
        fallback.append(
            {
                "project_name": str(update.get("project_name") or "").strip(),
                "work_notes": work_notes,
                "next_steps": next_steps,
                "blockers": blockers,
                "image_url": update.get("image_url"),
                "completion_percent": normalize_completion_percent(update.get("completion_percent")),
            }
        )
    return fallback

async def optimize_updates(updates: list[dict[str, Any]], style: str) -> tuple[list[dict[str, Any]], str]:
    for name, call in [("gemini", try_gemini_optimize), ("groq", try_groq_optimize)]:
        try:
            refined = await call(updates, style)
            if refined:
                return refined, name
        except Exception as e:
            logger.warning("%s optimize failed: %s", name, e)
    return fallback_optimize_updates(updates), "fallback"

def parse_datetime_value(value: Any) -> datetime:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, str):
        candidate = value.strip().replace("Z", "+00:00")
        try:
            parsed = datetime.fromisoformat(candidate)
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        except Exception:
            return datetime.now(timezone.utc)
    return datetime.now(timezone.utc)

def contains_mention(text: str, mention_tokens: list[str]) -> bool:
    content = (text or "").lower()
    return any(token in content for token in mention_tokens)

# --- ROUTES ---

@app.get("/api/backend/health")
async def health(): return {"status": "ok"}

@app.get("/api/backend/profiles/me", response_model=ProfileRecord)
async def get_my_profile(user: Any = Depends(get_current_user)):
    if not user.email:
        raise HTTPException(status_code=401, detail="Email not found in token")
        
    # Strictly query by the email in the verified token
    resp = await run_in_threadpool(supabase.table("profiles").select("*").eq("user_email", user.email.lower()).execute)
    
    if resp.data and len(resp.data) > 0:
        return ProfileRecord(**resp.data[0])
    
    # Auto-create profile ONLY for this specific email
    new_profile = {
        "user_email": user.email.lower(),
        "full_name": user.user_metadata.get("full_name") or user.email.split("@")[0],
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "avatar_url": None, # Force clean state for new users
        "cover_url": None,
        "bio": None
    }
    ins = await run_in_threadpool(supabase.table("profiles").insert(new_profile).execute)
    if not ins.data:
        raise HTTPException(status_code=500, detail="Failed to create profile")
    return ProfileRecord(**ins.data[0])

@app.get("/api/backend/profiles/all", response_model=list[ProfileRecord])
async def get_all_profiles(user: Any = Depends(get_current_user)):
    resp = await run_in_threadpool(supabase.table("profiles").select("*").execute)
    return [ProfileRecord(**p) for p in resp.data or []]

@app.get("/api/backend/profiles/fetch/{email}", response_model=ProfileRecord)
async def get_profile_by_email(email: str, user: Any = Depends(get_current_user)):
    target_email = (email or "").strip().lower()
    if not target_email:
        raise HTTPException(status_code=400, detail="Email is required")

    # Prefer case-insensitive match because historical rows may contain mixed-case emails.
    resp = await run_in_threadpool(supabase.table("profiles").select("*").ilike("user_email", target_email).execute)
    if not resp.data: raise HTTPException(status_code=404, detail="Not found")
    return ProfileRecord(**resp.data[0])

@app.put("/api/backend/profiles/me", response_model=ProfileRecord)
async def update_profile_me(update: ProfileUpdate, user: Any = Depends(get_current_user)):
    payload = {k: v for k, v in update.model_dump().items() if v is not None}
    payload["updated_at"] = datetime.now(timezone.utc).isoformat()
    resp = await run_in_threadpool(supabase.table("profiles").update(payload).eq("user_email", user.email).execute)
    return ProfileRecord(**resp.data[0])

@app.get("/api/backend/reports", response_model=list[DailyReportRecord])
async def get_all_reports(user: Any = Depends(get_current_user)):
    query = supabase.table("daily_reports").select("*")
    user_email = (user.email or "").lower()
    if user_email not in CEO_EMAILS:
        query = query.eq("author_email", user.email)
    resp = await run_in_threadpool(query.order("report_date", desc=True).execute)
    return [DailyReportRecord(**r) for r in resp.data or []]

@app.post("/api/backend/submit-report", response_model=SubmitReportResponse)
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

@app.post("/api/backend/optimize-updates", response_model=OptimizeUpdatesResponse)
async def optimize_report_updates(request: OptimizeUpdatesRequest, user: Any = Depends(get_current_user)):
    updates_dicts = [u.model_dump() for u in request.updates]
    refined_updates, provider = await optimize_updates(updates_dicts, (request.style or "executive").strip().lower())
    return OptimizeUpdatesResponse(
        message="Optimized",
        provider=provider,
        updates=[ProjectUpdate(**u) for u in refined_updates],
        preview=build_preview_line(refined_updates),
    )

@app.get("/api/backend/notifications", response_model=list[NotificationRecord])
async def get_notifications(user: Any = Depends(get_current_user)):
    user_email = (user.email or "").lower()
    if not user_email:
        raise HTTPException(status_code=401, detail="Email not found in token")

    profile_resp = await run_in_threadpool(
        supabase.table("profiles").select("full_name").eq("user_email", user_email).execute
    )
    full_name = (profile_resp.data[0]["full_name"] if profile_resp.data else "") or ""
    username = user_email.split("@")[0]
    mention_tokens = [f"@{username.lower()}"]
    if full_name:
        mention_tokens.append(f"@{full_name.lower()}")

    posts_resp = await run_in_threadpool(
        supabase.table("posts").select("*").order("created_at", desc=True).limit(240).execute
    )
    posts = posts_resp.data or []
    if not posts:
        return []

    post_ids = [p["id"] for p in posts]
    comments_resp = await run_in_threadpool(
        supabase.table("comments").select("*").in_("post_id", post_ids).order("created_at", desc=True).limit(500).execute
    )
    comments = comments_resp.data or []
    comment_ids = [c["id"] for c in comments]

    reactions_query = supabase.table("reactions").select("*")
    if comment_ids:
        reactions_query = reactions_query.or_(
            f"post_id.in.({','.join(post_ids)}),comment_id.in.({','.join(comment_ids)})"
        )
    else:
        reactions_query = reactions_query.in_("post_id", post_ids)
    reactions_resp = await run_in_threadpool(reactions_query.execute)
    reactions = reactions_resp.data or []

    actor_emails = set()
    for p in posts:
        if p.get("author_email"):
            actor_emails.add(p["author_email"])
    for c in comments:
        if c.get("author_email"):
            actor_emails.add(c["author_email"])
    for r in reactions:
        if r.get("author_email"):
            actor_emails.add(r["author_email"])

    profiles_map: dict[str, dict[str, Any]] = {}
    if actor_emails:
        actor_profiles_resp = await run_in_threadpool(
            supabase.table("profiles").select("*").in_("user_email", list(actor_emails)).execute
        )
        profiles_map = {p["user_email"]: p for p in actor_profiles_resp.data or []}

    post_by_id = {p["id"]: p for p in posts}
    comments_by_id = {c["id"]: c for c in comments}
    user_post_ids = {p["id"] for p in posts if (p.get("author_email") or "").lower() == user_email}
    user_comment_ids = {c["id"] for c in comments if (c.get("author_email") or "").lower() == user_email}

    notifications: list[NotificationRecord] = []
    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)

    def actor_info(email: str) -> tuple[str, Optional[str]]:
        profile = profiles_map.get(email or "")
        if profile:
            return profile.get("full_name") or email, profile.get("avatar_url")
        return email or "Teammate", None

    def append_notification(
        *,
        kind: str,
        created_at: datetime,
        actor_email: str,
        post_id: Optional[str],
        comment_id: Optional[str],
        title: str,
        body: str,
    ) -> None:
        if created_at < seven_days_ago:
            return
        actor_name, actor_avatar = actor_info(actor_email)
        notif_id = f"{kind}:{post_id or ''}:{comment_id or ''}:{actor_email}:{int(created_at.timestamp())}"
        notifications.append(
            NotificationRecord(
                id=notif_id,
                type=kind,
                created_at=created_at,
                actor_email=actor_email,
                actor_name=actor_name,
                actor_avatar=actor_avatar,
                post_id=post_id,
                comment_id=comment_id,
                title=title,
                body=body,
            )
        )

    for post in posts:
        post_author = (post.get("author_email") or "").lower()
        if not post_author or post_author == user_email:
            continue
        post_created = parse_datetime_value(post.get("created_at"))
        post_content = str(post.get("content") or "")

        append_notification(
            kind="new_post",
            created_at=post_created,
            actor_email=post_author,
            post_id=post.get("id"),
            comment_id=None,
            title="New Team Post",
            body=(post_content[:140] + "...") if len(post_content) > 140 else post_content or "New update posted.",
        )

        if contains_mention(post_content, mention_tokens):
            append_notification(
                kind="mention_post",
                created_at=post_created,
                actor_email=post_author,
                post_id=post.get("id"),
                comment_id=None,
                title="You Were Mentioned",
                body=(post_content[:140] + "...") if len(post_content) > 140 else post_content,
            )

    for comment in comments:
        comment_author = (comment.get("author_email") or "").lower()
        if not comment_author or comment_author == user_email:
            continue
        comment_created = parse_datetime_value(comment.get("created_at"))
        comment_content = str(comment.get("content") or "")
        parent_post_id = comment.get("post_id")

        if parent_post_id in user_post_ids:
            append_notification(
                kind="comment_post",
                created_at=comment_created,
                actor_email=comment_author,
                post_id=parent_post_id,
                comment_id=comment.get("id"),
                title="New Comment On Your Post",
                body=(comment_content[:140] + "...") if len(comment_content) > 140 else comment_content or "Someone commented on your post.",
            )

        if contains_mention(comment_content, mention_tokens):
            append_notification(
                kind="mention_comment",
                created_at=comment_created,
                actor_email=comment_author,
                post_id=parent_post_id,
                comment_id=comment.get("id"),
                title="You Were Mentioned In A Comment",
                body=(comment_content[:140] + "...") if len(comment_content) > 140 else comment_content,
            )

    for reaction in reactions:
        reaction_author = (reaction.get("author_email") or "").lower()
        if not reaction_author or reaction_author == user_email:
            continue
        reaction_created = parse_datetime_value(reaction.get("created_at"))
        reaction_emoji = str(reaction.get("emoji") or "👍")
        reaction_post_id = reaction.get("post_id")
        reaction_comment_id = reaction.get("comment_id")

        if reaction_post_id and reaction_post_id in user_post_ids:
            append_notification(
                kind="reaction_post",
                created_at=reaction_created,
                actor_email=reaction_author,
                post_id=reaction_post_id,
                comment_id=None,
                title=f"Reaction On Your Post {reaction_emoji}",
                body="A teammate reacted to your post.",
            )

        if reaction_comment_id and reaction_comment_id in user_comment_ids:
            parent_post_id = comments_by_id.get(reaction_comment_id, {}).get("post_id")
            append_notification(
                kind="reaction_comment",
                created_at=reaction_created,
                actor_email=reaction_author,
                post_id=parent_post_id,
                comment_id=reaction_comment_id,
                title=f"Reaction On Your Comment {reaction_emoji}",
                body="A teammate reacted to your comment.",
            )

    notifications.sort(key=lambda n: n.created_at, reverse=True)
    return notifications[:120]

@app.get("/api/backend/posts", response_model=list[PostRecord])
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

@app.post("/api/backend/posts", response_model=PostRecord)
async def create_new_post(req: CreatePostRequest, user: Any = Depends(get_current_user)):
    resp = await run_in_threadpool(supabase.table("posts").insert({"author_email": user.email, "content": req.content, "image_url": req.image_url}).execute)
    return PostRecord(**resp.data[0])

@app.delete("/api/backend/posts/{post_id}")
async def delete_post_by_id(post_id: str, user: Any = Depends(get_current_user)):
    await run_in_threadpool(supabase.table("posts").delete().eq("id", post_id).eq("author_email", user.email).execute)
    return {"status": "ok"}

@app.post("/api/backend/posts/{post_id}/comments", response_model=CommentRecord)
async def create_new_comment(post_id: str, req: CreateCommentRequest, user: Any = Depends(get_current_user)):
    resp = await run_in_threadpool(supabase.table("comments").insert({"post_id": post_id, "author_email": user.email, "content": req.content}).execute)
    return CommentRecord(**resp.data[0])

@app.delete("/api/backend/comments/{comment_id}")
async def delete_comment_by_id(comment_id: str, user: Any = Depends(get_current_user)):
    await run_in_threadpool(supabase.table("comments").delete().eq("id", comment_id).eq("author_email", user.email).execute)
    return {"status": "ok"}

@app.post("/api/backend/posts/{post_id}/reactions", response_model=ReactionRecord)
async def post_reaction(post_id: str, req: CreateReactionRequest, user: Any = Depends(get_current_user)):
    existing = await run_in_threadpool(supabase.table("reactions").select("*").eq("post_id", post_id).eq("author_email", user.email).eq("emoji", req.emoji).execute)
    if existing.data:
        await run_in_threadpool(supabase.table("reactions").delete().eq("id", existing.data[0]["id"]).execute)
        return ReactionRecord(**existing.data[0])
    resp = await run_in_threadpool(supabase.table("reactions").insert({"post_id": post_id, "author_email": user.email, "emoji": req.emoji}).execute)
    return ReactionRecord(**resp.data[0])

@app.post("/api/backend/comments/{comment_id}/reactions", response_model=ReactionRecord)
async def comment_reaction(comment_id: str, req: CreateReactionRequest, user: Any = Depends(get_current_user)):
    existing = await run_in_threadpool(supabase.table("reactions").select("*").eq("comment_id", comment_id).eq("author_email", user.email).eq("emoji", req.emoji).execute)
    if existing.data:
        await run_in_threadpool(supabase.table("reactions").delete().eq("id", existing.data[0]["id"]).execute)
        return ReactionRecord(**existing.data[0])
    resp = await run_in_threadpool(supabase.table("reactions").insert({"comment_id": comment_id, "author_email": user.email, "emoji": req.emoji}).execute)
    return ReactionRecord(**resp.data[0])
