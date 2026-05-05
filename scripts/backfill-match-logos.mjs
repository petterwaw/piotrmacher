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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchFixtureByIdWithRetry(apiHost, apiKey, fixtureId, maxAttempts = 4) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const url = new URL(`https://${apiHost}/fixtures`)
    url.searchParams.set('id', String(fixtureId))

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

  throw new Error('Unexpected retry state while fetching fixture by id.')
}

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

  const { data: matches, error: matchesError } = await supabase
    .from('matches')
    .select('id, provider_match_id, home_logo, away_logo')
    .not('provider_match_id', 'is', null)
    .or('home_logo.is.null,away_logo.is.null')

  if (matchesError) {
    throw new Error(`Could not load matches: ${matchesError.message}`)
  }

  if (!matches || matches.length === 0) {
    console.log('No matches with missing logos found.')
    return
  }

  console.log(`Found ${matches.length} match(es) with missing logos.`)

  let updated = 0
  let skipped = 0
  const failures = []

  for (const match of matches) {
    try {
      const fixtureId = String(match.provider_match_id)
      const response = await fetchFixtureByIdWithRetry(apiHost, apiKey, fixtureId)

      if (!response.ok) {
        failures.push({ fixtureId, message: `API status ${response.status}` })
        continue
      }

      const body = await response.json().catch(() => ({}))
      const fixture = body?.response?.[0]

      if (!fixture?.teams?.home?.logo && !fixture?.teams?.away?.logo) {
        skipped += 1
        continue
      }

      const { error: updateError } = await supabase
        .from('matches')
        .update({
          home_logo: fixture?.teams?.home?.logo ?? null,
          away_logo: fixture?.teams?.away?.logo ?? null,
        })
        .eq('id', match.id)

      if (updateError) {
        failures.push({ fixtureId, message: updateError.message })
        continue
      }

      updated += 1
    } catch (error) {
      failures.push({
        fixtureId: String(match.provider_match_id),
        message: error instanceof Error ? error.message : String(error),
      })
    }

    // Friendly cadence for lower API plans.
    await sleep(250)
  }

  console.log(`Updated: ${updated}`)
  console.log(`Skipped (no logos returned): ${skipped}`)
  if (failures.length > 0) {
    console.log(`Failures: ${failures.length}`)
    for (const failure of failures.slice(0, 20)) {
      console.log(`- Fixture ${failure.fixtureId}: ${failure.message}`)
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
