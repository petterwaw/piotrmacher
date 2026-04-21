import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

function loadDotEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) {
    return
  }

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    if (!line || line.trim().startsWith('#')) continue
    const idx = line.indexOf('=')
    if (idx <= 0) continue

    const key = line.slice(0, idx).trim()
    const value = line.slice(idx + 1).trim()
    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

function normalize(value) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function pickLeague(candidates, target) {
  if (!Array.isArray(candidates) || candidates.length === 0) return null

  const targetName = normalize(target.expectedName)
  const targetCountry = target.country ? normalize(target.country) : null
  const targetType = target.type ? normalize(target.type) : null

  const scored = candidates.map((item) => {
    const league = item.league
    const country = item.country

    let score = 0

    if (normalize(league.name) === targetName) score += 10
    if (normalize(league.name).includes(targetName)) score += 3

    if (targetCountry && country?.name && normalize(country.name) === targetCountry) score += 5
    if (targetType && league?.type && normalize(league.type) === targetType) score += 3

    return { item, score }
  })

  scored.sort((a, b) => b.score - a.score)
  return scored[0]?.item ?? null
}

function pickSeasonFromResponse(entry) {
  const seasons = Array.isArray(entry?.seasons) ? entry.seasons : []
  const current = seasons.find((s) => s.current)
  if (current?.year) return String(current.year)

  const latest = seasons
    .map((s) => s.year)
    .filter((year) => Number.isFinite(year))
    .sort((a, b) => b - a)[0]

  return latest ? String(latest) : String(new Date().getUTCFullYear())
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchLeaguesWithRetry(url, apiKey, maxAttempts = 4) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetch(url, {
      headers: {
        'x-apisports-key': apiKey,
      },
    })

    if (response.ok) {
      return response
    }

    if (response.status !== 429 || attempt === maxAttempts) {
      return response
    }

    const retryAfter = Number(response.headers.get('retry-after'))
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : attempt * 2000
    await sleep(waitMs)
  }

  throw new Error('Unexpected retry state while fetching leagues.')
}

const TARGET_EVENTS = [
  { expectedName: 'UEFA Champions League', search: 'UEFA Champions League', type: 'Cup' },
  { expectedName: 'UEFA Europa League', search: 'UEFA Europa League', type: 'Cup' },
  { expectedName: 'UEFA Europa Conference League', search: 'UEFA Europa Conference League', type: 'Cup' },
  { expectedName: 'FIFA World Cup', search: 'World Cup', type: 'Cup' },
  { expectedName: 'UEFA Nations League', search: 'UEFA Nations League', type: 'Cup' },

  { expectedName: 'Premier League', search: 'Premier League', country: 'England', type: 'League' },
  { expectedName: 'La Liga', search: 'La Liga', country: 'Spain', type: 'League' },
  { expectedName: 'Serie A', search: 'Serie A', country: 'Italy', type: 'League' },
  { expectedName: 'Bundesliga', search: 'Bundesliga', country: 'Germany', type: 'League' },
  { expectedName: 'Ligue 1', search: 'Ligue 1', country: 'France', type: 'League' },
  { expectedName: 'Eredivisie', search: 'Eredivisie', country: 'Netherlands', type: 'League' },
  { expectedName: 'Primeira Liga', search: 'Primeira Liga', country: 'Portugal', type: 'League' },
  { expectedName: 'Jupiler Pro League', search: 'Jupiler Pro League', country: 'Belgium', type: 'League' },
  { expectedName: 'Super Lig', search: 'Super Lig', country: 'Turkey', type: 'League' },
  { expectedName: 'Serie A', search: 'Serie A', country: 'Brazil', type: 'League' },
  { expectedName: 'Liga Profesional Argentina', search: 'Liga Profesional', country: 'Argentina', type: 'League' },
  { expectedName: 'Major League Soccer', search: 'Major League Soccer', country: 'USA', type: 'League' },
  { expectedName: 'Liga MX', search: 'Liga MX', country: 'Mexico', type: 'League' },
  { expectedName: 'Saudi Pro League', search: 'Saudi Pro League', country: 'Saudi-Arabia', type: 'League' },
  { expectedName: 'Championship', search: 'Championship', country: 'England', type: 'League' },
]

async function main() {
  loadDotEnvLocal()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
  const apiKey = process.env.FOOTBALL_API_KEY
  const apiHost = process.env.FOOTBALL_API_HOST || 'v3.football.api-sports.io'

  if (!supabaseUrl || !serviceRole || !apiKey) {
    throw new Error(
      'Missing env vars. Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FOOTBALL_API_KEY.'
    )
  }

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const rows = []
  const missing = []

  for (const target of TARGET_EVENTS) {
    const url = new URL(`https://${apiHost}/leagues`)
    url.searchParams.set('search', target.search)

    const response = await fetchLeaguesWithRetry(url, apiKey)

    if (!response.ok) {
      missing.push(`${target.expectedName} (API status ${response.status})`)
      continue
    }

    const payload = await response.json()
    const chosen = pickLeague(payload.response, target)

    if (!chosen?.league?.id) {
      missing.push(`${target.expectedName} (not found)`)
      continue
    }

    rows.push({
      name: target.expectedName,
      sport: 'football',
      season: pickSeasonFromResponse(chosen),
      provider: 'api-football',
      provider_event_id: String(chosen.league.id),
      is_active: true,
    })

    // Keep request cadence friendly for lower API plans.
    await sleep(300)
  }

  if (rows.length === 0) {
    throw new Error('No events resolved from API-Football. Nothing to upsert.')
  }

  const { error } = await supabase
    .from('events')
    .upsert(rows, { onConflict: 'provider,provider_event_id' })

  if (error) {
    throw error
  }

  console.log(`Upserted ${rows.length} events.`)
  if (missing.length > 0) {
    console.log('Missing entries:')
    for (const entry of missing) {
      console.log(`- ${entry}`)
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
