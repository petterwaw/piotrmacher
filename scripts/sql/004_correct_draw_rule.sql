-- Run once in Supabase SQL editor.
-- Adds separate correct_draw rule to all existing room rules.

update public.rooms
set rules = jsonb_set(
  coalesce(rules, '{}'::jsonb),
  '{correct_draw}',
  coalesce(coalesce(rules, '{}'::jsonb) -> 'correct_draw', '1'::jsonb),
  true
)
where true;
