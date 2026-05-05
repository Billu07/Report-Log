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

-- Social Features

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_email text unique not null,
  full_name text not null,
  avatar_url text,
  cover_url text,
  bio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_email text not null references public.profiles(user_email),
  content text not null,
  image_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_email text not null references public.profiles(user_email),
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.posts(id) on delete cascade,
  comment_id uuid references public.comments(id) on delete cascade,
  author_email text not null references public.profiles(user_email),
  emoji text not null,
  created_at timestamptz not null default now(),
  check (
    (post_id is not null and comment_id is null) or
    (post_id is null and comment_id is not null)
  )
);

-- Task System

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  priority text not null default 'medium',
  status text not null default 'todo',
  assigned_to_email text not null references public.profiles(user_email),
  assigned_by_email text not null references public.profiles(user_email),
  due_date date,
  assignment_attachments jsonb not null default '[]'::jsonb,
  submission_note text,
  submission_attachments jsonb not null default '[]'::jsonb,
  submitted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (priority in ('low', 'medium', 'high', 'urgent')),
  check (status in ('todo', 'in_progress', 'submitted', 'done'))
);

alter table public.tasks
  add column if not exists assignment_attachments jsonb not null default '[]'::jsonb;

alter table public.tasks
  add column if not exists submission_attachments jsonb not null default '[]'::jsonb;

create index if not exists tasks_assigned_to_email_idx
  on public.tasks (assigned_to_email, status, due_date);

create index if not exists tasks_created_at_idx
  on public.tasks (created_at desc);
