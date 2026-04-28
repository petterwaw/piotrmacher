-- Run once in Supabase SQL editor.

alter table public.bets
add column if not exists points integer;

create table if not exists public.scoring_jobs (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  unique (match_id)
);

create index if not exists scoring_jobs_status_created_idx
  on public.scoring_jobs (status, created_at);

create index if not exists scoring_jobs_match_id_idx
  on public.scoring_jobs (match_id);

create index if not exists bets_match_id_idx
  on public.bets (match_id);

create index if not exists bets_room_user_idx
  on public.bets (room_id, user_id);

alter table public.scoring_jobs enable row level security;

-- No authenticated policy on purpose: only service-role worker should read/write scoring jobs.
