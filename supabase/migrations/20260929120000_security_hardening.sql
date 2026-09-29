-- =====================================================================
-- Security hardening (2026-09-29)
--
-- Context: the anon key is public, so every logged-in user can talk to
-- PostgREST directly and bypass /api/**. RLS + grants are the real gate.
-- This migration only changes privileges, policies, functions and triggers.
-- It does not delete or modify any rows.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Table privileges
-- ---------------------------------------------------------------------
-- No policy targets `anon`, so it never needs table access.
revoke all on all tables in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;

-- Written only by the service role (sync / scoring jobs).
revoke insert, update, delete on public.events, public.matches, public.scoring_jobs, public.pickem_group_teams
  from authenticated;

-- ---------------------------------------------------------------------
-- 2. room_players: no direct inserts (anyone could join any room and set
--    their own `points`). Joining goes through join_room_by_code(); the
--    host is added by a trigger. Points are written by the service role.
-- ---------------------------------------------------------------------
drop policy if exists room_players_insert_self_only on public.room_players;
revoke insert, update on public.room_players from authenticated;

create or replace function public.join_room_by_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select r.id into v_room_id
  from public.rooms r
  where r.invite_code = lower(trim(p_code));

  if v_room_id is null then
    return null;
  end if;

  insert into public.room_players (room_id, user_id)
  values (v_room_id, auth.uid())
  on conflict (room_id, user_id) do nothing;

  return v_room_id;
end;
$$;

revoke all on function public.join_room_by_code(text) from public, anon;
grant execute on function public.join_room_by_code(text) to authenticated;

drop trigger if exists rooms_add_host on public.rooms;
create trigger rooms_add_host
  after insert on public.rooms
  for each row execute function public.add_host_to_room_players();

-- ---------------------------------------------------------------------
-- 3. bets: users may only write their prediction, never `points`,
--    and only before kickoff (by time, not just by synced status).
-- ---------------------------------------------------------------------
revoke insert, update on public.bets from authenticated;
grant insert (room_id, user_id, match_id, home_score, away_score) on public.bets to authenticated;
grant update (home_score, away_score, updated_at) on public.bets to authenticated;

alter table public.bets
  add constraint bets_points_nonnegative check (points is null or points >= 0);

drop policy if exists bets_insert_self_before_start on public.bets;
create policy bets_insert_self_before_start on public.bets
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.is_room_member(room_id)
    and exists (
      select 1
      from public.matches m
      join public.rooms r on r.id = bets.room_id
      where m.id = bets.match_id
        and r.status = 'active'
        and m.status in ('scheduled', 'delayed')
        and m.scheduled_start_at > now()
    )
  );

drop policy if exists bets_update_self_before_start on public.bets;
create policy bets_update_self_before_start on public.bets
  for update to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.matches m
      where m.id = bets.match_id
        and m.status in ('scheduled', 'delayed')
        and m.scheduled_start_at > now()
    )
  )
  with check (
    user_id = (select auth.uid())
    and public.is_room_member(room_id)
    and exists (
      select 1 from public.matches m
      where m.id = bets.match_id
        and m.status in ('scheduled', 'delayed')
        and m.scheduled_start_at > now()
    )
  );

drop policy if exists bets_delete_self_before_start on public.bets;
create policy bets_delete_self_before_start on public.bets
  for delete to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.matches m
      where m.id = bets.match_id
        and m.status in ('scheduled', 'delayed')
        and m.scheduled_start_at > now()
    )
  );

-- ---------------------------------------------------------------------
-- 4. rooms: hosts may edit settings only while waiting, and status only
--    moves forward (waiting -> active -> finished). Previously a host could
--    reset status to 'waiting', change rules/event mid-game, and restart.
-- ---------------------------------------------------------------------
revoke insert, update on public.rooms from authenticated;
grant insert (name, host_id, event_id, rules, room_end_at) on public.rooms to authenticated;
grant update (name, event_id, rules, room_end_at, status) on public.rooms to authenticated;

drop policy if exists rooms_insert_for_host_only on public.rooms;
create policy rooms_insert_for_host_only on public.rooms
  for insert to authenticated
  with check (host_id = (select auth.uid()) and status = 'waiting');

create or replace function public.enforce_room_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from jsonb_each(new.rules) as rule(key, value)
    where jsonb_typeof(rule.value) <> 'number'
       or (rule.value)::text::numeric < 0
       or (rule.value)::text::numeric > 100
  ) then
    raise exception 'Room rules must be numbers between 0 and 100';
  end if;

  if tg_op = 'UPDATE' then
    if new.status is distinct from old.status
       and not (
         (old.status = 'waiting' and new.status in ('active', 'finished'))
         or (old.status = 'active' and new.status = 'finished')
       ) then
      raise exception 'Invalid room status change: % -> %', old.status, new.status;
    end if;

    if old.status <> 'waiting' and (
      new.rules is distinct from old.rules
      or new.event_id is distinct from old.event_id
      or new.room_end_at is distinct from old.room_end_at
    ) then
      raise exception 'Room settings can only be changed while the room is waiting';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_rules_change_after_start on public.rooms;
drop trigger if exists trg_enforce_room_rules on public.rooms;
create trigger trg_enforce_room_rules
  before insert or update on public.rooms
  for each row execute function public.enforce_room_rules();

drop function if exists public.prevent_rules_change_after_start();

-- ---------------------------------------------------------------------
-- 5. pickem picks: users write only their order, never points. Other
--    members' picks become visible at the event's first kickoff, which is
--    also when the API locks editing (before: as soon as the room started,
--    while picks could still be edited -> copying was possible).
-- ---------------------------------------------------------------------
revoke insert, update on public.pickem_group_picks from authenticated;
grant insert (room_id, user_id, event_id, group_key, ordered_team_ids, updated_at)
  on public.pickem_group_picks to authenticated;
grant update (ordered_team_ids, updated_at) on public.pickem_group_picks to authenticated;

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
        and (
          r.host_id = p_viewer_id
          or exists (
            select 1 from public.room_players rp
            where rp.room_id = r.id and rp.user_id = p_viewer_id
          )
        )
        and exists (
          select 1 from public.matches m
          where m.event_id = r.event_id and m.scheduled_start_at <= now()
        )
    );
$$;

-- ---------------------------------------------------------------------
-- 6. Room totals: always recomputed from bets + pickem (service role only).
-- ---------------------------------------------------------------------
create or replace function public.recompute_room_player_points(p_room_ids uuid[])
returns void
language sql
security definer
set search_path = ''
as $$
  update public.room_players rp
  set points =
      coalesce((select sum(b.points) from public.bets b
                where b.room_id = rp.room_id and b.user_id = rp.user_id), 0)
    + coalesce((select sum(p.points) from public.pickem_group_picks p
                where p.room_id = rp.room_id and p.user_id = rp.user_id), 0)
  where rp.room_id = any(p_room_ids);
$$;

revoke all on function public.recompute_room_player_points(uuid[]) from public, anon, authenticated;
grant execute on function public.recompute_room_player_points(uuid[]) to service_role;

-- ---------------------------------------------------------------------
-- 7. Function privileges: nothing is callable by `anon`; trigger functions
--    are not callable by clients at all (triggers don't need EXECUTE).
-- ---------------------------------------------------------------------
revoke execute on function
  public.can_access_pickem_event(uuid, uuid),
  public.can_access_pickem_room(uuid, uuid),
  public.can_write_pickem_room(uuid, uuid, uuid),
  public.can_read_pickem_pick(uuid, uuid, uuid),
  public.is_room_member(uuid),
  public.is_room_host(uuid),
  public.get_room_id_by_invite_code(text)
from public, anon;

revoke execute on function
  public.handle_new_user(),
  public.add_host_to_room_players(),
  public.set_updated_at(),
  public.validate_bet_match_room_event(),
  public.enforce_room_rules()
from public, anon, authenticated;

commit;
