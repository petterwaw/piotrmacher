import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

type SyncEventTarget = {
  providerEventId: string
  season: string
}

type ApiFootballFixture = {
  fixture: {
    id: number
    date: string
    status: {
      short: string
      elapsed: number | null
    }
  }
  goals: {
    home: number | null
    away: number | null
  }
  teams: {
    home: { name: string; logo?: string | null }
    away: { name: string; logo?: string | null }
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

async function runSync(request: NextRequest) {
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

  const nowIso = new Date().toISOString()
  await supabase
    .from('rooms')
    .update({ status: 'finished' })
    .eq('status', 'active')
    .not('room_end_at', 'is', null)
    .lte('room_end_at', nowIso)

  const { data: activeRoomsWithEvent } = await supabase
    .from('rooms')
    .select('id, events!inner(is_active)')
    .eq('status', 'active')

  const roomsToFinishByEvent = (activeRoomsWithEvent ?? [])
    .filter((row) => {
      const event = Array.isArray(row.events) ? row.events[0] : row.events
      return event && event.is_active === false
    })
    .map((row) => row.id)

  if (roomsToFinishByEvent.length > 0) {
    await supabase.from('rooms').update({ status: 'finished' }).in('id', roomsToFinishByEvent)
  }

  const { data: eventRows, error: eventsError } = await supabase
    .from('rooms')
    .select('event_id, events!inner(provider, provider_event_id, season, is_active)')
    .eq('status', 'active')

  if (eventsError) {
    return NextResponse.json({ error: 'Could not load active room events.' }, { status: 500 })
  }

  const eventMap = new Map<string, SyncEventTarget>()

  for (const row of eventRows ?? []) {
    const event = Array.isArray(row.events) ? row.events[0] : row.events
    if (!event) continue
    if (event.provider !== 'api-football') continue
    if (!event.is_active) continue
    if (!event.provider_event_id) continue

    eventMap.set(row.event_id, {
      providerEventId: event.provider_event_id,
      season: event.season ?? String(new Date().getUTCFullYear()),
    })
  }

  console.log(`[sync-matches] Found ${eventMap.size} active api-football events`)

  const now = new Date()

  // Smart scheduling: sync event only when at least one match is due (next_sync_at <= now),
  // when there are live matches, or when event has no tracked upcoming matches yet.
  const eventIds = [...eventMap.keys()]
  const { data: trackedMatches } = eventIds.length
    ? await supabase
        .from('matches')
        .select('event_id, status, next_sync_at, scheduled_start_at')
        .in('event_id', eventIds)
        .in('status', ['scheduled', 'delayed', 'live'])
    : { data: [] }

  const trackedByEvent = new Map<string, Array<{ status: string; next_sync_at: string | null; scheduled_start_at: string | null }>>()

  for (const match of trackedMatches ?? []) {
    const current = trackedByEvent.get(match.event_id) ?? []
    current.push({
      status: match.status,
      next_sync_at: match.next_sync_at,
      scheduled_start_at: (match as { scheduled_start_at?: string | null }).scheduled_start_at ?? null,
    })
    trackedByEvent.set(match.event_id, current)
  }

  const dueEventMap = new Map<string, SyncEventTarget>()

  for (const [eventId, target] of eventMap.entries()) {
    const tracked = trackedByEvent.get(eventId) ?? []

    // If no tracked upcoming/live matches exist yet, seed the event now.
    if (tracked.length === 0) {
      dueEventMap.set(eventId, target)
      continue
    }

    const hasDueMatch = tracked.some((match) => {
      if (match.status === 'live') {
        return true
      }

      if (!match.next_sync_at) {
        return true
      }

      // Force sync when the match start time has already passed but status is still scheduled/delayed.
      // This prevents cron from skipping an event because next_sync_at was set before the match started.
      if (match.scheduled_start_at && new Date(match.scheduled_start_at).getTime() <= now.getTime()) {
        return true
      }

      return new Date(match.next_sync_at).getTime() <= now.getTime()
    })

    if (hasDueMatch) {
      dueEventMap.set(eventId, target)
    }
  }

  console.log(`[sync-matches] ${dueEventMap.size}/${eventMap.size} events have due matches`)

  const updates: Array<Record<string, unknown>> = []
  const failures: Array<{ eventId: string; message: string }> = []

  // If there are finished matches without a scoring job yet, force-sync the event.
  if (eventIds.length > 0) {
    const { data: finishedMatches } = await supabase
      .from('matches')
      .select('id, event_id')
      .in('event_id', eventIds)
      .eq('status', 'finished')

    const finishedIds = (finishedMatches ?? []).map((row) => String(row.id))
    const { data: betRows } = finishedIds.length
      ? await supabase.from('bets').select('match_id').in('match_id', finishedIds)
      : { data: [] }

    const betMatchIds = new Set((betRows ?? []).map((row) => String(row.match_id)))
    const candidateMatchIds = [...betMatchIds]
    const { data: existingJobs } = candidateMatchIds.length
      ? await supabase.from('scoring_jobs').select('match_id').in('match_id', candidateMatchIds)
      : { data: [] }

    const jobMatchIds = new Set((existingJobs ?? []).map((row) => row.match_id))
    const eventsWithUnscored = new Set<string>()

    for (const row of finishedMatches ?? []) {
      const matchId = String(row.id)
      if (betMatchIds.has(matchId) && !jobMatchIds.has(matchId)) {
        eventsWithUnscored.add(row.event_id)
      }
    }

    for (const eventId of eventsWithUnscored) {
      if (!dueEventMap.has(eventId) && eventMap.has(eventId)) {
        dueEventMap.set(eventId, eventMap.get(eventId)!)
      }
    }

    if (eventsWithUnscored.size > 0) {
      console.log(`[sync-matches] ${eventsWithUnscored.size} events forced for unscored finished matches`)
    }
  }

  // Catch up after cron downtime by including recent past fixtures as well.
  const fromDate = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const toDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  for (const [eventId, { providerEventId, season }] of dueEventMap.entries()) {
    try {
      const url = new URL(`https://${apiHost}/fixtures`)
      url.searchParams.set('league', providerEventId)
      url.searchParams.set('season', season)
      url.searchParams.set('from', fromDate)
      url.searchParams.set('to', toDate)

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'x-apisports-key': apiKey,
        },
      })

      const body = (await response.json().catch(() => ({}))) as {
        response?: ApiFootballFixture[]
        errors?: Record<string, string>
      }

      if (!response.ok) {
        failures.push({ eventId, message: `API status ${response.status}` })
        continue
      }

      if (body.errors && Object.keys(body.errors).length > 0) {
        const providerMessage = Object.entries(body.errors)
          .map(([key, value]) => `${key}: ${value}`)
          .join('; ')
        failures.push({ eventId, message: `Provider error: ${providerMessage}` })
        continue
      }

      const fixtures = body.response ?? []

      for (const fixture of fixtures) {
        const status = toMatchStatus(fixture.fixture.status.short)
        const resultMode = toResultMode(fixture.fixture.status.short)
        const nextSyncAt = computeNextSyncAt(status, fixture.fixture.date)

        const ft = fixture.score.fulltime
        const aet = fixture.score.extratime
        const pens = fixture.score.penalty
        const liveHome = fixture.goals.home
        const liveAway = fixture.goals.away
        const primaryHomeScore = status === 'live' ? liveHome : ft.home
        const primaryAwayScore = status === 'live' ? liveAway : ft.away
        updates.push({
          event_id: eventId,
          provider_match_id: String(fixture.fixture.id),
          home_team: fixture.teams.home.name,
          away_team: fixture.teams.away.name,
          home_logo: fixture.teams.home.logo ?? null,
          away_logo: fixture.teams.away.logo ?? null,
          scheduled_start_at: fixture.fixture.date,
          status,
          result_mode: resultMode,
          home_score_ft: primaryHomeScore,
          away_score_ft: primaryAwayScore,
          home_score_aet: aet.home,
          away_score_aet: aet.away,
          home_score_pens: pens.home,
          away_score_pens: pens.away,
          live_minute: fixture.fixture.status.elapsed,
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
    let { error: upsertError } = await supabase
      .from('matches')
      .upsert(updates, { onConflict: 'event_id,provider_match_id' })

    if (upsertError?.message?.toLowerCase().includes('live_minute')) {
      const fallbackUpdates = updates.map((row) => {
        const { live_minute: _liveMinute, ...rest } = row as Record<string, unknown>
        return rest
      })

      const fallbackResult = await supabase
        .from('matches')
        .upsert(fallbackUpdates, { onConflict: 'event_id,provider_match_id' })

      upsertError = fallbackResult.error
    }

    if (upsertError) {
      return NextResponse.json({ error: 'Could not upsert matches.' }, { status: 500 })
    }

    const finishedByEvent = new Map<string, Set<string>>()
    for (const row of updates) {
      const eventId = String(row.event_id)
      const providerMatchId = String(row.provider_match_id)
      const status = String(row.status)
      if (status !== 'finished') continue

      const current = finishedByEvent.get(eventId) ?? new Set<string>()
      current.add(providerMatchId)
      finishedByEvent.set(eventId, current)
    }

    const jobRows: Array<{ match_id: string }> = []

    for (const [eventId, providerIdsSet] of finishedByEvent.entries()) {
      const providerIds = [...providerIdsSet]
      if (providerIds.length === 0) continue

      const { data: finishedMatches } = await supabase
        .from('matches')
        .select('id')
        .eq('event_id', eventId)
        .eq('status', 'finished')
        .in('provider_match_id', providerIds)

      const finishedIds = (finishedMatches ?? []).map((match) => String(match.id))
      const { data: betRows } = finishedIds.length
        ? await supabase.from('bets').select('match_id').in('match_id', finishedIds)
        : { data: [] }
      const betMatchIds = new Set((betRows ?? []).map((row) => String(row.match_id)))

      for (const match of finishedMatches ?? []) {
        const matchId = String(match.id)
        if (!betMatchIds.has(matchId)) continue

        jobRows.push({
          match_id: matchId,
        })
      }
    }

    if (jobRows.length > 0) {
      await supabase.from('scoring_jobs').upsert(jobRows, { onConflict: 'match_id' })
      console.log(`[sync-matches] Enqueued ${jobRows.length} finished matches for scoring`)
    }
  }

  return NextResponse.json({
    ok: true,
    eventsProcessed: dueEventMap.size,
    eventsSkipped: Math.max(0, eventMap.size - dueEventMap.size),
    matchesUpserted: updates.length,
    failures,
  })
}

export async function POST(request: NextRequest) {
  return runSync(request)
}

export async function GET(request: NextRequest) {
  return runSync(request)
}