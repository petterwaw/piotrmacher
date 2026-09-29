-- =====================================================================
-- Switch the match data provider from API-Football (paid) to ESPN.
--
-- Rooms reference events by id, so events are re-pointed in place.
-- Only UPDATEs, nothing is deleted. The 2026 World Cup event keeps its
-- API-Football ids (its pickem picks store API-Football team ids).
-- =====================================================================

begin;

update public.events e
set provider = 'espn',
    provider_event_id = v.slug,
    season = v.season,
    is_active = true
from (values
  ('106', 'pol.1',            '2026/27'),  -- Ekstraklasa
  ('107', 'pol.2',            '2026/27'),  -- I Liga
  ('39',  'eng.1',            '2026/27'),  -- Premier League
  ('40',  'eng.2',            '2026/27'),  -- Championship
  ('140', 'esp.1',            '2026/27'),  -- La Liga
  ('135', 'ita.1',            '2026/27'),  -- Serie A
  ('78',  'ger.1',            '2026/27'),  -- Bundesliga
  ('61',  'fra.1',            '2026/27'),  -- Ligue 1
  ('2',   'uefa.champions',   '2026/27'),  -- Champions League
  ('3',   'uefa.europa',      '2026/27'),  -- Europa League
  ('848', 'uefa.europa.conf', '2026/27'),  -- Conference League
  ('5',   'uefa.nations',     '2026/27')   -- Nations League
) as v(old_id, slug, season)
where e.provider = 'api-football'
  and e.provider_event_id = v.old_id;

-- Everything still on API-Football can no longer be synced.
update public.events
set is_active = false
where provider = 'api-football';

-- Open matches with API-Football ids will never be updated again. Void the
-- ones nobody bet on so they don't linger as "scheduled"; keep the rest.
update public.matches m
set status = 'cancelled',
    result_mode = 'void',
    next_sync_at = null
where m.status in ('scheduled', 'delayed', 'live')
  and m.provider_match_id not like 'espn:%'
  and not exists (select 1 from public.bets b where b.match_id = m.id);

commit;
