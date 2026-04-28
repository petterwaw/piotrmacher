import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  fs
    .readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((line) => !line.startsWith('#'))
    .map((line) => {
      const idx = line.indexOf('=')
      return [line.slice(0, idx), line.slice(idx + 1)]
    })
)

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const host = env.FOOTBALL_API_HOST || 'v3.football.api-sports.io'
const key = env.FOOTBALL_API_KEY

const now = new Date()
const from = now.toISOString().slice(0, 10)
const to = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

const { data: activeRoom, error: roomError } = await supabase
  .from('rooms')
  .select('event_id')
  .eq('status', 'active')
  .limit(1)
  .maybeSingle()

if (roomError || !activeRoom?.event_id) {
  console.log('NO_ACTIVE_ROOM', roomError?.message ?? '')
  process.exit(1)
}

const { data: event, error: eventError } = await supabase
  .from('events')
  .select('id, name, season, provider_event_id')
  .eq('id', activeRoom.event_id)
  .single()

if (eventError || !event?.provider_event_id) {
  console.log('NO_EVENT_PROVIDER_ID', eventError?.message ?? '')
  process.exit(1)
}

const url = new URL(`https://${host}/fixtures`)
url.searchParams.set('league', String(event.provider_event_id))
url.searchParams.set('season', String(event.season ?? new Date().getUTCFullYear()))
url.searchParams.set('from', from)
url.searchParams.set('to', to)

const resp = await fetch(url, {
  headers: {
    'x-apisports-key': key,
  },
})
const body = await resp.json().catch(() => ({}))

console.log('API status/results', resp.status, body.results)

const fixture = body.response?.[0]
if (!fixture) {
  console.log('NO_FIXTURE_IN_RANGE')
  process.exit(0)
}

const row = {
  event_id: event.id,
  provider_match_id: String(fixture.fixture.id),
  home_team: fixture.teams.home.name,
  away_team: fixture.teams.away.name,
  scheduled_start_at: fixture.fixture.date,
  status: 'scheduled',
  result_mode: 'regular',
  home_score_ft: fixture.score.fulltime.home,
  away_score_ft: fixture.score.fulltime.away,
  home_score_aet: fixture.score.extratime.home,
  away_score_aet: fixture.score.extratime.away,
  home_score_pens: fixture.score.penalty.home,
  away_score_pens: fixture.score.penalty.away,
  final_home_score: fixture.score.fulltime.home,
  final_away_score: fixture.score.fulltime.away,
  last_synced_at: new Date().toISOString(),
  next_sync_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  sync_error_count: 0,
  last_sync_error: null,
}

const { data, error } = await supabase
  .from('matches')
  .upsert([row], { onConflict: 'event_id,provider_match_id' })
  .select('id, event_id, provider_match_id')

console.log('UPSERT_ERROR', error)
console.log('UPSERT_DATA', data)
