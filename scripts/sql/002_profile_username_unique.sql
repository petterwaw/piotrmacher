-- Run once in Supabase SQL editor.
-- Enforces case-insensitive uniqueness for profile usernames.

create unique index if not exists profiles_username_unique_lower_idx
  on public.profiles (lower(username));
