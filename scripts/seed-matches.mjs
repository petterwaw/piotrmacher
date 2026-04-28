import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

function loadDotEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return

  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) continue
    const idx = line.indexOf('=')
    if (idx <= 0) continue
    const key = line.slice(0, idx).trim()
    const value = line.slice(idx + 1).trim()
    if (!process.env[key]) process.env[key] = value
  }
}

function toMatchStatus(short) {
  const live = new Set(['1H', 'HT', '2H', 'ET', 'P', 'BT'])
  const finished = new Set(['FT', 'AET', 'PEN'])
  if (live.has(short)) return 'live'
  if (finished.has(short)) return 'finished'
  if (short === 'PST') return 'delayed'
  if (short === 'CANC' || short === 'ABD') return 'cancelled'
  return 'scheduled'
}

function toResultMode(short) {
  if (short === 'PEN') return 'pens'
  if (short === 'AET') return 'aet'
  if (short === 'CANC' || short === 'ABD') return 'void'
  return 'regular'
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function toDateString(date) {
  return date.toISOString().slice(0, 10)
}

async function fetchFixtures(apiHost, apiKey, leagueId, season) {
  const now = new Date()
  const from = now
  const to = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  const url = new URL(`https://${apiHost}/fixtures`)
  url.searchParams.set('league', String(leagueId))
  url.searchParams.set('season', String(season))
  url.searchParams.set('from', toDateString(from))
  url.searchParams.set('to', toDateString(to))

  const response = await fetch(url, { headers: { 'x-apisports-key': apiKey } })

  if (!response.ok) {
    throw new Error(`API status ${response.status} for league ${leagueId}`)
  }

  const body = await response.json().catch(() => ({}))
  return body.response ?? []
}

async function main() {
  loadDotEnvLocal()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
  const apiKey = process.env.FOOTBALL_API_KEY
  const apiHost = process.env.FOOTBALL_API_HOST || 'v3.football.api-sports.io'

  if (!supabaseUrl || !serviceRole || !apiKey) {
    throw new Error('Missing env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FOOTBALL_API_KEY')
  }

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Load all active events that have an api-football provider ID
  const { data: events, error: eventsError } = await supabase
    .from('events')
    .select('id, name, season, provider_event_id')
    .eq('is_active', true)
    .eq('provider', 'api-football')
    .not('provider_event_id', 'is', null)

  if (eventsError) throw new Error(`Could not load events: ${eventsError.message}`)
  if (!events || events.length === 0) throw new Error('No active api-football events found. Run seed:events first.')

  console.log(`Found ${events.length} event(s) to sync.`)

  let totalUpserted = 0
  const failures = []

  for (const event of events) {
    const season = event.season ?? String(new Date().getUTCFullYear())
    console.log(`\nSyncing: ${event.name} (season ${season}, league ${event.provider_event_id})`)

    try {
      const fixtures = await fetchFixtures(apiHost, apiKey, event.provider_event_id, season)
      console.log(`  Fetched ${fixtures.length} fixture(s).`)

      if (fixtures.length === 0) {
        console.log('  Skipping — no fixtures returned.')
        await sleep(400)
        continue
      }

      const rows = fixtures.map((fixture) => {
        const status = toMatchStatus(fixture.fixture.status.short)
        const resultMode = toResultMode(fixture.fixture.status.short)

        return {
          event_id: event.id,
          provider_match_id: String(fixture.fixture.id),
          home_team: fixture.teams.home.name,
          away_team: fixture.teams.away.name,
          scheduled_start_at: fixture.fixture.date,
          status,
          result_mode: resultMode,
          home_score_ft: fixture.score.fulltime.home,
          away_score_ft: fixture.score.fulltime.away,
          home_score_aet: fixture.score.extratime.home,
          away_score_aet: fixture.score.extratime.away,
          home_score_pens: fixture.score.penalty.home,
          away_score_pens: fixture.score.penalty.away,
          live_minute: fixture.fixture.status.elapsed,
          last_synced_at: new Date().toISOString(),
          next_sync_at: status === 'finished' || status === 'cancelled' ? null : new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          sync_error_count: 0,
          last_sync_error: null,
        }
      })

      // Upsert in batches of 200 to avoid payload limits
      const batchSize = 200
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize)
        const { error: upsertError } = await supabase
          .from('matches')
          .upsert(batch, { onConflict: 'event_id,provider_match_id' })

        if (upsertError) {
          throw new Error(`Upsert failed: ${upsertError.message}`)
        }
      }

      totalUpserted += rows.length
      console.log(`  Upserted ${rows.length} match(es).`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`  ERROR: ${message}`)
      failures.push({ event: event.name, message })
    }

    // Be polite to the API rate limiter
    await sleep(500)
  }

  console.log(`\nDone. Total upserted: ${totalUpserted}`)

  if (failures.length > 0) {
    console.log('Failed events:')
    for (const f of failures) console.log(`  - ${f.event}: ${f.message}`)
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
