create extension if not exists pgcrypto;

create table if not exists public.daily_reports (
  id uuid primary key default gen_random_uuid(),
  report_date date not null,
  author_name text not null default 'Unknown',
  raw_text text not null,
  formatted_report text not null,
  image_url text,
  created_at timestamptz not null default now()
);

create index if not exists daily_reports_report_date_idx
  on public.daily_reports (report_date desc);

create index if not exists daily_reports_created_at_idx
  on public.daily_reports (created_at desc);

