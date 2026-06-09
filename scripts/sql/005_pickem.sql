-- Run once in Supabase SQL editor.
-- Adds Pickem group ordering, per-user picks, scoring support, and RLS.
-- Safe for production: this creates new objects and only adds one default key to rooms.rules.

update public.rooms
set rules = jsonb_set(
  coalesce(rules, '{}'::jsonb),
  '{pickem_correct_position}',
  coalesce(coalesce(rules, '{}'::jsonb) -> 'pickem_correct_position', '1'::jsonb),
  true
)
where true;

create table if not exists public.pickem_group_teams (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  group_key text not null,
  group_name text not null,
  group_order integer not null default 0 check (group_order >= 0),
  provider_team_id text not null,
  team_name text not null,
  team_logo text,
  initial_position integer check (initial_position is null or initial_position > 0),
  current_position integer check (current_position is null or current_position > 0),
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, group_key, provider_team_id)
);

create index if not exists pickem_group_teams_event_group_idx
  on public.pickem_group_teams (event_id, group_key, group_order, current_position);

create table if not exists public.pickem_group_picks (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  group_key text not null,
  ordered_team_ids text[] not null default '{}'::text[],
  points integer not null default 0 check (points >= 0),
  scored_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (room_id, user_id, event_id, group_key),
  check (cardinality(ordered_team_ids) > 0)
);

create index if not exists pickem_group_picks_room_user_idx
  on public.pickem_group_picks (room_id, user_id);

create index if not exists pickem_group_picks_event_group_idx
  on public.pickem_group_picks (event_id, group_key);

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
          select 1
          from public.room_players rp
          where rp.room_id = r.id
            and rp.user_id = p_user_id
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
          select 1
          from public.room_players rp
          where rp.room_id = r.id
            and rp.user_id = p_user_id
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
          select 1
          from public.room_players rp
          where rp.room_id = r.id
            and rp.user_id = p_user_id
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
            select 1
            from public.room_players rp
            where rp.room_id = r.id
              and rp.user_id = p_viewer_id
          )
        )
    );
$$;

revoke all on function public.can_access_pickem_event(uuid, uuid) from public;
revoke all on function public.can_access_pickem_room(uuid, uuid) from public;
revoke all on function public.can_write_pickem_room(uuid, uuid, uuid) from public;
revoke all on function public.can_read_pickem_pick(uuid, uuid, uuid) from public;

grant execute on function public.can_access_pickem_event(uuid, uuid) to authenticated;
grant execute on function public.can_access_pickem_room(uuid, uuid) to authenticated;
grant execute on function public.can_write_pickem_room(uuid, uuid, uuid) to authenticated;
grant execute on function public.can_read_pickem_pick(uuid, uuid, uuid) to authenticated;

alter table public.pickem_group_teams enable row level security;
alter table public.pickem_group_picks enable row level security;

drop policy if exists "Room members can read pickem group teams" on public.pickem_group_teams;
create policy "Room members can read pickem group teams"
on public.pickem_group_teams
for select
to authenticated
using (public.can_access_pickem_event(event_id, auth.uid()));

-- No client insert/update/delete policies for pickem_group_teams.
-- These rows are refreshed only by service-role server code from API-Football.

drop policy if exists "Room members can read pickem picks" on public.pickem_group_picks;
create policy "Room members can read pickem picks"
on public.pickem_group_picks
for select
to authenticated
using (public.can_read_pickem_pick(room_id, user_id, auth.uid()));

drop policy if exists "Users can insert own waiting-room pickem picks" on public.pickem_group_picks;
create policy "Users can insert own waiting-room pickem picks"
on public.pickem_group_picks
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.can_write_pickem_room(room_id, event_id, auth.uid())
);

drop policy if exists "Users can update own waiting-room pickem picks" on public.pickem_group_picks;
create policy "Users can update own waiting-room pickem picks"
on public.pickem_group_picks
for update
to authenticated
using (
  user_id = auth.uid()
  and public.can_write_pickem_room(room_id, event_id, auth.uid())
)
with check (
  user_id = auth.uid()
  and public.can_write_pickem_room(room_id, event_id, auth.uid())
);

drop policy if exists "Users can delete own waiting-room pickem picks" on public.pickem_group_picks;
create policy "Users can delete own waiting-room pickem picks"
on public.pickem_group_picks
for delete
to authenticated
using (
  user_id = auth.uid()
  and public.can_write_pickem_room(room_id, event_id, auth.uid())
);
