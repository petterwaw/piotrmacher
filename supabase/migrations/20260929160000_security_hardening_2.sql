-- =====================================================================
-- Security hardening, round 2 (2026-09-29), from a second audit.
-- Privileges, policies, functions and column defaults only; no rows are
-- changed. Existing invite codes stay as they are.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Pickem: lock writes at the event's first kickoff in the database too
--    (was only enforced by the API route; PostgREST allowed edits while
--    other members' picks were already visible).
-- ---------------------------------------------------------------------
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
      and not exists (
        select 1 from public.matches m
        where m.event_id = r.event_id and m.scheduled_start_at <= now()
      )
  );
$$;

-- ---------------------------------------------------------------------
-- 2. Policy helpers take a user id argument, so calling them through
--    /rest/v1/rpc answered "is user X in room Y?" for anyone. Move them
--    out of the API-exposed schema; policies reference them by OID.
-- ---------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

alter function public.can_access_pickem_event(uuid, uuid) set schema private;
alter function public.can_access_pickem_room(uuid, uuid) set schema private;
alter function public.can_read_pickem_pick(uuid, uuid, uuid) set schema private;
alter function public.can_write_pickem_room(uuid, uuid, uuid) set schema private;
alter function public.is_room_member(uuid) set schema private;
alter function public.is_room_host(uuid) set schema private;

-- ---------------------------------------------------------------------
-- 3. Invite codes: unused lookup RPC let anyone test codes; new codes get
--    72 random bits instead of 32; finished rooms can't be joined.
-- ---------------------------------------------------------------------
drop function if exists public.get_room_id_by_invite_code(text);

alter table public.rooms
  alter column invite_code set default encode(extensions.gen_random_bytes(9), 'hex');

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
  where r.invite_code = lower(trim(p_code))
    and r.status <> 'finished';

  if v_room_id is null then
    return null;
  end if;

  insert into public.room_players (room_id, user_id)
  values (v_room_id, auth.uid())
  on conflict (room_id, user_id) do nothing;

  return v_room_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Bets can only be edited/removed while the room is active.
-- ---------------------------------------------------------------------
drop policy if exists bets_update_self_before_start on public.bets;
create policy bets_update_self_before_start on public.bets
  for update to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.matches m
      join public.rooms r on r.id = bets.room_id
      where m.id = bets.match_id
        and r.status = 'active'
        and m.status in ('scheduled', 'delayed')
        and m.scheduled_start_at > now()
    )
  )
  with check (
    user_id = (select auth.uid())
    and private.is_room_member(room_id)
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

drop policy if exists bets_delete_self_before_start on public.bets;
create policy bets_delete_self_before_start on public.bets
  for delete to authenticated
  using (
    user_id = (select auth.uid())
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

-- ---------------------------------------------------------------------
-- 5. Starting a room requires an active event (the API checked this, but
--    hosts could set status directly).
-- ---------------------------------------------------------------------
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

    if old.status = 'waiting' and new.status = 'active' and not exists (
      select 1 from public.events e where e.id = new.event_id and e.is_active
    ) then
      raise exception 'Cannot start a room for an inactive event';
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

-- ---------------------------------------------------------------------
-- 6. Leftover privileges.
-- ---------------------------------------------------------------------
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
-- Note: schema `net` (pg_net) is owned and granted by supabase_admin, so
-- `postgres` cannot revoke anon/authenticated access there. It is not in the
-- PostgREST-exposed schemas, so clients can't reach it through the API.
revoke all on public.scoring_jobs from authenticated;

commit;
