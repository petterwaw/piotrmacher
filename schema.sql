-- =====================================================================
-- schema.sql  –  Complete database schema for betting_app
--
-- Run this once on a fresh Supabase project.
-- It creates all tables, indexes, functions, triggers, and RLS policies
-- needed to run the application from scratch.
--
-- Requirements:
--   • Supabase project with auth enabled
--   • Run as the postgres superuser (or via Supabase SQL editor)
-- =====================================================================


-- =====================================================================
-- 1. TABLES
-- =====================================================================

create table if not exists public.profiles (
  id         uuid        primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  username   text        check (username ~ '^[a-zA-Z0-9_.]{3,20}$'),
  role       text        default 'user'
);

create table if not exists public.events (
  id                uuid        primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  name              text        not null,
  sport             text        not null default 'football',
  season            text,
  provider          text        not null default 'manual',
  provider_event_id text,
  is_active         boolean     not null default true,
  logo              text
);

create table if not exists public.rooms (
  id          uuid        primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  name        text        not null,
  host_id     uuid        not null references auth.users(id),
  event_id    uuid        not null references public.events(id),
  status      text        not null default 'waiting'
                check (status in ('waiting', 'active', 'finished')),
  invite_code text        not null default substring(md5(random()::text), 1, 8) unique,
  rules       jsonb       not null default '{
    "correct_winner": 1,
    "correct_draw": 1,
    "correct_difference": 1,
    "correct_away_goals": 1,
    "correct_home_goals": 1,
    "exact_score": 1,
    "exact_draw": 1,
    "pickem_correct_position": 1
  }'::jsonb,
  room_end_at timestamptz
);

create table if not exists public.room_players (
  id        uuid        primary key default gen_random_uuid(),
  room_id   uuid        not null references public.rooms(id)    on delete cascade,
  user_id   uuid        not null references auth.users(id)      on delete cascade,
  joined_at timestamptz not null default now(),
  points    integer     not null default 0
);

create table if not exists public.matches (
  id                 uuid        primary key default gen_random_uuid(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  event_id           uuid        not null references public.events(id),
  provider_match_id  text,
  home_team          text        not null,
  away_team          text        not null,
  scheduled_start_at timestamptz not null,
  actual_start_at    timestamptz,
  status             text        not null default 'scheduled'
                       check (status in ('scheduled', 'delayed', 'live', 'finished', 'cancelled')),
  home_score_ft      integer     check (home_score_ft  is null or home_score_ft  >= 0),
  away_score_ft      integer     check (away_score_ft  is null or away_score_ft  >= 0),
  home_score_aet     integer     check (home_score_aet is null or home_score_aet >= 0),
  away_score_aet     integer     check (away_score_aet is null or away_score_aet >= 0),
  home_score_pens    integer     check (home_score_pens is null or home_score_pens >= 0),
  away_score_pens    integer     check (away_score_pens is null or away_score_pens >= 0),
  result_mode        text        not null default 'regular'
                       check (result_mode in ('regular', 'aet', 'pens', 'void')),
  -- Always recomputed from the score columns above.
  final_home_score   integer generated always as (
    case result_mode
      when 'pens' then coalesce(home_score_pens, home_score_aet, home_score_ft)
      when 'aet'  then coalesce(home_score_aet,  home_score_ft)
      else             home_score_ft
    end
  ) stored,
  final_away_score   integer generated always as (
    case result_mode
      when 'pens' then coalesce(away_score_pens, away_score_aet, away_score_ft)
      when 'aet'  then coalesce(away_score_aet,  away_score_ft)
      else             away_score_ft
    end
  ) stored,
  last_synced_at     timestamptz,
  next_sync_at       timestamptz,
  sync_error_count   integer     not null default 0,
  last_sync_error    text,
  live_minute        integer,
  home_logo          text,
  away_logo          text
);

create table if not exists public.bets (
  id         uuid        primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  room_id    uuid        not null references public.rooms(id)   on delete cascade,
  user_id    uuid        not null references auth.users(id)     on delete cascade,
  match_id   uuid        not null references public.matches(id) on delete cascade,
  home_score integer     not null check (home_score >= 0),
  away_score integer     not null check (away_score >= 0),
  points     integer
);

create table if not exists public.scoring_jobs (
  id          uuid        primary key default gen_random_uuid(),
  match_id    uuid        not null references public.matches(id) on delete cascade unique,
  status      text        not null default 'pending'
                check (status in ('pending', 'processing', 'completed', 'failed')),
  attempts    integer     not null default 0,
  last_error  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  started_at  timestamptz,
  finished_at timestamptz
);

create table if not exists public.pickem_group_teams (
  id               uuid        primary key default gen_random_uuid(),
  event_id         uuid        not null references public.events(id) on delete cascade,
  group_key        text        not null,
  group_name       text        not null,
  group_order      integer     not null default 0 check (group_order >= 0),
  provider_team_id text        not null,
  team_name        text        not null,
  team_logo        text,
  initial_position integer     check (initial_position is null or initial_position > 0),
  current_position integer     check (current_position is null or current_position > 0),
  last_synced_at   timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (event_id, group_key, provider_team_id)
);

create table if not exists public.pickem_group_picks (
  id               uuid        primary key default gen_random_uuid(),
  room_id          uuid        not null references public.rooms(id)   on delete cascade,
  user_id          uuid        not null references auth.users(id)     on delete cascade,
  event_id         uuid        not null references public.events(id)  on delete cascade,
  group_key        text        not null,
  ordered_team_ids text[]      not null default '{}'::text[],
  points           integer     not null default 0 check (points >= 0),
  scored_at        timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (room_id, user_id, event_id, group_key),
  check (cardinality(ordered_team_ids) > 0)
);


-- =====================================================================
-- 2. INDEXES
-- =====================================================================

-- Enforce case-insensitive username uniqueness.
create unique index if not exists profiles_username_unique_lower_idx
  on public.profiles (lower(username));

create index if not exists rooms_status_room_end_at_idx
  on public.rooms (status, room_end_at);

create index if not exists scoring_jobs_status_created_idx
  on public.scoring_jobs (status, created_at);

create index if not exists scoring_jobs_match_id_idx
  on public.scoring_jobs (match_id);

create index if not exists bets_match_id_idx
  on public.bets (match_id);

create index if not exists bets_room_user_idx
  on public.bets (room_id, user_id);

create index if not exists pickem_group_teams_event_group_idx
  on public.pickem_group_teams (event_id, group_key, group_order, current_position);

create index if not exists pickem_group_picks_room_user_idx
  on public.pickem_group_picks (room_id, user_id);

create index if not exists pickem_group_picks_event_group_idx
  on public.pickem_group_picks (event_id, group_key);


-- =====================================================================
-- 3. AUTH TRIGGER  –  auto-create profile on sign-up
-- =====================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    new.raw_user_meta_data ->> 'username'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- =====================================================================
-- 4. PICKEM HELPER FUNCTIONS
-- (security definer so RLS policies stay simple)
-- =====================================================================

create or replace function public.can_access_pickem_event(p_event_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.rooms r
    where r.event_id = p_event_id
      and (
        r.host_id = p_user_id
        or exists (
          select 1 from public.room_players rp
          where rp.room_id = r.id and rp.user_id = p_user_id
        )
      )
  );
$$;

create or replace function public.can_access_pickem_room(p_room_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.rooms r
    where r.id = p_room_id
      and (
        r.host_id = p_user_id
        or exists (
          select 1 from public.room_players rp
          where rp.room_id = r.id and rp.user_id = p_user_id
        )
      )
  );
$$;

create or replace function public.can_write_pickem_room(p_room_id uuid, p_event_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.rooms r
    where r.id = p_room_id
      and r.event_id = p_event_id
      and r.status = 'waiting'
      and (
        r.host_id = p_user_id
        or exists (
          select 1 from public.room_players rp
          where rp.room_id = r.id and rp.user_id = p_user_id
        )
      )
  );
$$;

create or replace function public.can_read_pickem_pick(p_room_id uuid, p_pick_user_id uuid, p_viewer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_pick_user_id = p_viewer_id
    or exists (
      select 1
      from public.rooms r
      where r.id = p_room_id
        and r.status <> 'waiting'
        and (
          r.host_id = p_viewer_id
          or exists (
            select 1 from public.room_players rp
            where rp.room_id = r.id and rp.user_id = p_viewer_id
          )
        )
    );
$$;

-- Restrict direct public access; grant only to authenticated role.
revoke all on function public.can_access_pickem_event(uuid, uuid)           from public;
revoke all on function public.can_access_pickem_room(uuid, uuid)            from public;
revoke all on function public.can_write_pickem_room(uuid, uuid, uuid)       from public;
revoke all on function public.can_read_pickem_pick(uuid, uuid, uuid)        from public;

grant execute on function public.can_access_pickem_event(uuid, uuid)        to authenticated;
grant execute on function public.can_access_pickem_room(uuid, uuid)         to authenticated;
grant execute on function public.can_write_pickem_room(uuid, uuid, uuid)    to authenticated;
grant execute on function public.can_read_pickem_pick(uuid, uuid, uuid)     to authenticated;


-- =====================================================================
-- 5. ROW LEVEL SECURITY
-- =====================================================================

-- ── profiles ──────────────────────────────────────────────────────────
alter table public.profiles enable row level security;

create policy "Authenticated users can read any profile"
  on public.profiles for select to authenticated using (true);

-- Needed so the auth trigger (security definer) can insert during signup.
create policy "Users can insert their own profile"
  on public.profiles for insert to authenticated with check (id = auth.uid());

create policy "Users can update their own profile"
  on public.profiles for update to authenticated using (id = auth.uid());

-- ── events ────────────────────────────────────────────────────────────
alter table public.events enable row level security;

create policy "Authenticated users can read events"
  on public.events for select to authenticated using (true);
-- INSERT / UPDATE / DELETE are service-role only (no client policies).

-- ── rooms ─────────────────────────────────────────────────────────────
alter table public.rooms enable row level security;

create policy "Authenticated users can read rooms"
  on public.rooms for select to authenticated using (true);

create policy "Authenticated users can create rooms"
  on public.rooms for insert to authenticated with check (host_id = auth.uid());

create policy "Host can update their rooms"
  on public.rooms for update to authenticated using (host_id = auth.uid());

create policy "Host can delete their rooms"
  on public.rooms for delete to authenticated using (host_id = auth.uid());

-- ── room_players ──────────────────────────────────────────────────────
alter table public.room_players enable row level security;

create policy "Authenticated users can read room players"
  on public.room_players for select to authenticated using (true);

create policy "Users can join rooms"
  on public.room_players for insert to authenticated with check (user_id = auth.uid());

-- Users can leave; hosts can remove any member.
create policy "Users can leave or host can remove members"
  on public.room_players for delete to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.rooms r
      where r.id = room_id and r.host_id = auth.uid()
    )
  );

-- ── matches ───────────────────────────────────────────────────────────
alter table public.matches enable row level security;

create policy "Authenticated users can read matches"
  on public.matches for select to authenticated using (true);
-- INSERT / UPDATE / DELETE are service-role only (no client policies).

-- ── bets ──────────────────────────────────────────────────────────────
alter table public.bets enable row level security;

-- Room members (and the host) can read all bets within their rooms.
create policy "Room members can read bets"
  on public.bets for select to authenticated
  using (
    exists (
      select 1 from public.rooms r
      where r.id = room_id
        and (
          r.host_id = auth.uid()
          or exists (
            select 1 from public.room_players rp
            where rp.room_id = r.id and rp.user_id = auth.uid()
          )
        )
    )
  );

create policy "Room members can place bets"
  on public.bets for insert to authenticated with check (user_id = auth.uid());

create policy "Users can update their own bets"
  on public.bets for update to authenticated using (user_id = auth.uid());

-- Users can delete their own bets; hosts can delete all bets in their rooms
-- (needed when a host deletes a room via the server-side client).
create policy "Users or hosts can delete bets"
  on public.bets for delete to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.rooms r
      where r.id = room_id and r.host_id = auth.uid()
    )
  );

-- ── scoring_jobs ──────────────────────────────────────────────────────
-- No client-side access. Only the service-role worker reads/writes these.
alter table public.scoring_jobs enable row level security;

-- ── pickem_group_teams ────────────────────────────────────────────────
alter table public.pickem_group_teams enable row level security;

create policy "Room members can read pickem group teams"
  on public.pickem_group_teams for select to authenticated
  using (public.can_access_pickem_event(event_id, auth.uid()));
-- INSERT / UPDATE / DELETE are service-role only (synced from API-Football).

-- ── pickem_group_picks ────────────────────────────────────────────────
alter table public.pickem_group_picks enable row level security;

create policy "Room members can read pickem picks"
  on public.pickem_group_picks for select to authenticated
  using (public.can_read_pickem_pick(room_id, user_id, auth.uid()));

create policy "Users can insert own waiting-room pickem picks"
  on public.pickem_group_picks for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.can_write_pickem_room(room_id, event_id, auth.uid())
  );

create policy "Users can update own waiting-room pickem picks"
  on public.pickem_group_picks for update to authenticated
  using (
    user_id = auth.uid()
    and public.can_write_pickem_room(room_id, event_id, auth.uid())
  )
  with check (
    user_id = auth.uid()
    and public.can_write_pickem_room(room_id, event_id, auth.uid())
  );

create policy "Users can delete own waiting-room pickem picks"
  on public.pickem_group_picks for delete to authenticated
  using (
    user_id = auth.uid()
    and public.can_write_pickem_room(room_id, event_id, auth.uid())
  );
