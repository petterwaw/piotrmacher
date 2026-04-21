import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

type ApiFootballFixture = {
  fixture: {
    id: number
    date: string
    status: {
      short: string
    }
  }
  teams: {
    home: { name: string }
    away: { name: string }
  }
  score: {
    fulltime: { home: number | null; away: number | null }
    extratime: { home: number | null; away: number | null }
    penalty: { home: number | null; away: number | null }
  }
}

function toMatchStatus(short: string): 'scheduled' | 'delayed' | 'live' | 'finished' | 'cancelled' {
  const liveCodes = new Set(['1H', 'HT', '2H', 'ET', 'P', 'BT'])
  const finishedCodes = new Set(['FT', 'AET', 'PEN'])

  if (liveCodes.has(short)) return 'live'
  if (finishedCodes.has(short)) return 'finished'
  if (short === 'PST') return 'delayed'
  if (short === 'CANC' || short === 'ABD') return 'cancelled'
  return 'scheduled'
}

function toResultMode(short: string): 'regular' | 'aet' | 'pens' | 'void' {
  if (short === 'PEN') return 'pens'
  if (short === 'AET') return 'aet'
  if (short === 'CANC' || short === 'ABD') return 'void'
  return 'regular'
}

function computeNextSyncAt(status: 'scheduled' | 'delayed' | 'live' | 'finished' | 'cancelled', scheduledStartAt: string) {
  if (status === 'finished' || status === 'cancelled') {
    return null
  }

  const now = new Date()

  if (status === 'live') {
    return new Date(now.getTime() + 5 * 60 * 1000).toISOString()
  }

  const scheduled = new Date(scheduledStartAt)
  const twoHoursMs = 2 * 60 * 60 * 1000
  const diff = scheduled.getTime() - now.getTime()

  if (diff <= twoHoursMs) {
    return new Date(now.getTime() + 10 * 60 * 1000).toISOString()
  }

  return new Date(now.getTime() + 60 * 60 * 1000).toISOString()
}

export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const apiKey = process.env.FOOTBALL_API_KEY
  const apiHost = process.env.FOOTBALL_API_HOST || 'v3.football.api-sports.io'

  if (!supabaseUrl || !serviceRoleKey || !apiKey) {
    return NextResponse.json(
      { error: 'Missing env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or FOOTBALL_API_KEY' },
      { status: 500 }
    )
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const { data: eventRows, error: eventsError } = await supabase
    .from('rooms')
    .select('event_id, events!inner(provider, provider_event_id, is_active)')
    .in('status', ['waiting', 'active'])

  if (eventsError) {
    return NextResponse.json({ error: 'Could not load active room events.' }, { status: 500 })
  }

  const eventMap = new Map<string, string>()

  for (const row of eventRows ?? []) {
    const event = Array.isArray(row.events) ? row.events[0] : row.events
    if (!event) continue
    if (event.provider !== 'api-football') continue
    if (!event.is_active) continue
    if (!event.provider_event_id) continue

    eventMap.set(row.event_id, event.provider_event_id)
  }

  const updates: Array<Record<string, unknown>> = []
  const failures: Array<{ eventId: string; message: string }> = []

  for (const [eventId, providerEventId] of eventMap.entries()) {
    try {
      const url = new URL(`https://${apiHost}/fixtures`)
      url.searchParams.set('league', providerEventId)
      url.searchParams.set('next', '20')

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'x-apisports-key': apiKey,
        },
      })

      const body = (await response.json().catch(() => ({}))) as {
        response?: ApiFootballFixture[]
      }

      if (!response.ok) {
        failures.push({ eventId, message: `API status ${response.status}` })
        continue
      }

      const fixtures = body.response ?? []

      for (const fixture of fixtures) {
        const status = toMatchStatus(fixture.fixture.status.short)
        const resultMode = toResultMode(fixture.fixture.status.short)
        const nextSyncAt = computeNextSyncAt(status, fixture.fixture.date)

        updates.push({
          event_id: eventId,
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
          last_synced_at: new Date().toISOString(),
          next_sync_at: nextSyncAt,
          sync_error_count: 0,
          last_sync_error: null,
        })
      }
    } catch {
      failures.push({ eventId, message: 'Unhandled fetch error' })
    }
  }

  if (updates.length > 0) {
    const { error: upsertError } = await supabase
      .from('matches')
      .upsert(updates, { onConflict: 'event_id,provider_match_id' })

    if (upsertError) {
      return NextResponse.json({ error: 'Could not upsert matches.' }, { status: 500 })
    }
  }

  return NextResponse.json({
    ok: true,
    eventsProcessed: eventMap.size,
    matchesUpserted: updates.length,
    failures,
  })
}