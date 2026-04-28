-- Run once in Supabase SQL editor.
-- Adds optional room end date (active until).

alter table public.rooms
add column if not exists room_end_at timestamptz;

create index if not exists rooms_status_room_end_at_idx
  on public.rooms (status, room_end_at);
