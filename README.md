# Daily Report Automation System

A full-stack reporting workflow that turns raw work notes and optional field images into polished daily reports, stores them in Supabase, and visualizes activity in a calendar-driven Next.js interface.

## Stack

- Frontend: Next.js App Router, React, Tailwind CSS, date-fns
- Backend: FastAPI, python-dotenv
- Data + storage: Supabase Postgres and Supabase Storage
- AI fallback chain: Gemini -> Groq -> Hugging Face

## Project Structure

```text
.
|-- app/
|   |-- globals.css
|   |-- layout.tsx
|   `-- page.tsx
|-- backend/
|   |-- .env.example
|   |-- Procfile
|   |-- __init__.py
|   |-- main.py
|   `-- requirements.txt
|-- supabase/
|   `-- init.sql
|-- .env.local.example
|-- eslint.config.mjs
|-- next.config.ts
|-- package.json
|-- postcss.config.mjs
|-- render.yaml
`-- tsconfig.json
```

## 1. Supabase Setup

1. Create a new Supabase project.
2. Open the SQL editor and run `supabase/init.sql`.
3. Copy your project URL and service role key from the project settings.
4. Create a Storage bucket named `daily-report-images`, or keep the startup auto-create behavior and make sure your service role key has access.

## 2. Backend Setup

1. Open `backend/.env.example`.
2. Copy it to `backend/.env`.
3. Fill in all required secrets:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `GEMINI_API_KEY`
   - `GROQ_API_KEY`
   - `HUGGINGFACE_API_KEY`
   - `FRONTEND_ORIGIN`

### Run backend locally

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Health check:

```text
GET http://127.0.0.1:8000/health
```

## 3. Frontend Setup

1. Copy `.env.local.example` to `.env.local`.
2. Point `NEXT_PUBLIC_API_BASE_URL` to your backend URL.

### Run frontend locally

```powershell
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

## 4. Local Run Order

1. Start the FastAPI backend on port `8000`.
2. Start the Next.js frontend on port `3000`.
3. Open the frontend and submit a report from the intake form.
4. Confirm the calendar highlights the chosen date and the detail panel renders the saved report.

## 5. Deploy Backend

### Render

Use the included `render.yaml` or create a web service manually with:

- Build command: `pip install -r backend/requirements.txt`
- Start command: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`

Set the backend environment variables from `backend/.env.example`.

### Railway

Create a service that points at the repository and set the root directory to `backend`, then use:

- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

You can also use the `backend/Procfile`.

## 6. Deploy Frontend

Deploy the root project to Vercel. Before the deploy, add:

- `NEXT_PUBLIC_API_BASE_URL` = your live backend URL

After the frontend domain is assigned, update the backend's `FRONTEND_ORIGIN` to the exact Vercel domain and redeploy the backend so CORS allows browser requests.

## 7. Deployment Order

1. Create Supabase project and run `supabase/init.sql`
2. Deploy backend
3. Add backend URL to frontend env vars
4. Deploy frontend
5. Update backend `FRONTEND_ORIGIN` to the final frontend URL
6. Re-test report submission and calendar rendering

