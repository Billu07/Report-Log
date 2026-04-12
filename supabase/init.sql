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
  post_id uuid not null references public.posts(id) on delete cascade,
  author_email text not null references public.profiles(user_email),
  emoji text not null,
  created_at timestamptz not null default now(),
  unique(post_id, author_email, emoji)
);

