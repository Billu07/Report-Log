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
from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
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
            raise HTTPException(status_code=401, detail="Invalid or expired token.")
        return user_response.user
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {e}")


class DailyReportRecord(BaseModel):
    id: Optional[str] = None
    report_date: date
    author_name: str
    raw_text: str
    formatted_report: str
    image_url: Optional[str] = None
    created_at: Optional[datetime] = None


class SubmitReportResponse(BaseModel):
    message: str
    report: DailyReportRecord
    provider: str = Field(..., description="The AI provider that produced the report.")


def build_prompt(raw_text: str, image_url: Optional[str] = None) -> str:
    image_context = (
        f"\nReference image URL: {image_url}\nUse the image as supporting context if it is useful."
        if image_url
        else "\nNo image was attached."
    )
    return (
        "You are an elite executive assistant preparing a polished daily progress report.\n"
        "Transform the raw work notes into a concise, professional update with this structure:\n"
        "1. Title\n"
        "2. Key accomplishments\n"
        "3. Blockers or risks\n"
        "4. Next actions\n"
        "5. Summary sentence\n\n"
        "Guidelines:\n"
        "- Be punchy, specific, and executive-friendly.\n"
        "- Preserve facts; do not invent milestones.\n"
        "- Convert shorthand and fragments into clean business language.\n"
        "- Use bullets where they improve readability.\n"
        "- Mention image evidence only if it adds value.\n"
        f"{image_context}\n\n"
        f"Raw notes:\n{raw_text}"
    )


async def fetch_image_payload(image_url: str) -> Optional[dict[str, Any]]:
    """
    Gemini's legacy SDK accepts binary image data, not a remote URL.
    We download the public asset from Supabase Storage and pass it in-line.
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
    except Exception as exc:  # pragma: no cover - defensive for flaky remote assets
        logger.warning("Unable to fetch image for Gemini multimodal prompt: %s", exc)
        return None


async def try_gemini(raw_text: str, image_url: Optional[str] = None) -> str:
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not configured.")

    prompt = build_prompt(raw_text=raw_text, image_url=image_url)
    model = genai.GenerativeModel(GEMINI_MODEL)

    contents: list[Any] = [prompt]
    if image_url:
        image_payload = await fetch_image_payload(image_url)
        if image_payload:
            contents.append(image_payload)

    response = await model.generate_content_async(
        contents=contents,
        generation_config={"temperature": 0.3},
    )

    if not getattr(response, "text", "").strip():
        raise RuntimeError("Gemini returned an empty report.")
    return response.text.strip()


async def try_groq(raw_text: str, image_url: Optional[str] = None) -> str:
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
                "content": build_prompt(raw_text=raw_text, image_url=image_url),
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


async def try_huggingface(raw_text: str, image_url: Optional[str] = None) -> str:
    prompt = build_prompt(raw_text=raw_text, image_url=image_url)
    return await asyncio.to_thread(_run_huggingface_completion, prompt)


async def generate_report(
    raw_text: str, image_url: Optional[str] = None
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
            formatted_report = await provider_call(raw_text=raw_text, image_url=image_url)
            logger.info("Report generated with %s", provider_name)
            return formatted_report, provider_name
        except Exception as exc:
            last_error = exc
            logger.exception("%s report generation failed", provider_name)

    raise RuntimeError(
        f"All AI providers failed to generate a report. Last error: {last_error}"
    )


async def ensure_storage_bucket_exists() -> None:
    """
    This keeps first-run setup smoother in new environments.
    If the bucket already exists, Supabase will raise and we simply continue.
    """
    try:
        await run_in_threadpool(
            partial(
                supabase.storage.create_bucket,
                SUPABASE_REPORTS_BUCKET,
                {"public": True},
            )
        )
        logger.info("Created storage bucket: %s", SUPABASE_REPORTS_BUCKET)
    except Exception:
        logger.info("Storage bucket already exists or could not be created automatically.")


@app.on_event("startup")
async def startup_event() -> None:
    await ensure_storage_bucket_exists()


async def upload_image_to_supabase(file: UploadFile) -> str:
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="The uploaded image file is empty.")

    suffix = Path(file.filename or "report-image").suffix or ".jpg"
    storage_path = f"{datetime.now(timezone.utc).strftime('%Y/%m/%d')}/{uuid4().hex}{suffix}"
    content_type = file.content_type or mimetypes.guess_type(file.filename or "")[0]

    await run_in_threadpool(
        partial(
            supabase.storage.from_(SUPABASE_REPORTS_BUCKET).upload,
            storage_path,
            file_bytes,
            {"content-type": content_type or "image/jpeg", "upsert": "true"},
        )
    )

    public_url_response = supabase.storage.from_(SUPABASE_REPORTS_BUCKET).get_public_url(
        storage_path
    )
    public_url = (
        public_url_response.get("publicUrl")
        if isinstance(public_url_response, dict)
        else public_url_response
    )
    if not public_url:
        raise HTTPException(status_code=500, detail="Failed to create a public image URL.")
    return public_url


@app.get("/health")
async def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/submit-report", response_model=SubmitReportResponse)
async def submit_report(
    raw_text: str = Form(..., min_length=10),
    report_date: Optional[date] = Form(None),
    image: Optional[UploadFile] = File(None),
    user: Any = Depends(get_current_user)
) -> SubmitReportResponse:
    """
    Accepts a raw brain dump and an optional image, generates a polished report,
    and persists it to the `daily_reports` table in Supabase.
    """
    author_name = user.user_metadata.get("full_name") or user.email

    image_url: Optional[str] = None
    if image:
        image_url = await upload_image_to_supabase(image)

    try:
        formatted_report, provider = await generate_report(
            raw_text=raw_text,
            image_url=image_url,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Report generation failed across all providers: {exc}",
        ) from exc

    payload = {
        "report_date": (report_date or date.today()).isoformat(),
        "author_name": author_name,
        "raw_text": raw_text,
        "formatted_report": formatted_report,
        "image_url": image_url,
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
