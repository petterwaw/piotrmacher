-- =====================================================================
-- New competitions from ESPN (free, keyless). API-Football (paid) events
-- are kept as history: deactivated and no longer synced. Existing rooms,
-- matches and bets are left untouched. ESPN has no Polish leagues.
-- =====================================================================

begin;

insert into public.events (name, sport, season, provider, provider_event_id, is_active, logo)
values
  ('Premier League',                'football', '2026/27', 'espn', 'eng.1',            true, 'https://a.espncdn.com/i/leaguelogos/soccer/500/23.png'),
  ('Championship',                  'football', '2026/27', 'espn', 'eng.2',            true, 'https://a.espncdn.com/i/leaguelogos/soccer/500/24.png'),
  ('La Liga',                       'football', '2026/27', 'espn', 'esp.1',            true, 'https://a.espncdn.com/i/leaguelogos/soccer/500/15.png'),
  ('Serie A',                       'football', '2026/27', 'espn', 'ita.1',            true, 'https://a.espncdn.com/i/leaguelogos/soccer/500/12.png'),
  ('Bundesliga',                    'football', '2026/27', 'espn', 'ger.1',            true, 'https://a.espncdn.com/i/leaguelogos/soccer/500/10.png'),
  ('Ligue 1',                       'football', '2026/27', 'espn', 'fra.1',            true, 'https://a.espncdn.com/i/leaguelogos/soccer/500/9.png'),
  ('UEFA Champions League',         'football', '2026/27', 'espn', 'uefa.champions',   true, 'https://a.espncdn.com/i/leaguelogos/soccer/500/2.png'),
  ('UEFA Europa League',            'football', '2026/27', 'espn', 'uefa.europa',      true, 'https://a.espncdn.com/i/leaguelogos/soccer/500/2310.png'),
  ('UEFA Conference League',        'football', '2026/27', 'espn', 'uefa.europa.conf', true, 'https://a.espncdn.com/i/leaguelogos/soccer/500/20296.png'),
  ('UEFA Nations League',           'football', '2026/27', 'espn', 'uefa.nations',     true, 'https://a.espncdn.com/i/leaguelogos/soccer/500/2395.png')
on conflict (provider, provider_event_id) do nothing;

-- API-Football events become history. Rooms still active on them are
-- finished by the next tick (rooms on inactive events are closed).
update public.events
set is_active = false
where provider = 'api-football'
  and is_active;

commit;
