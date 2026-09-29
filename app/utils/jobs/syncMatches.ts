import 'server-only'
import type { createServiceRoleSupabaseClient } from '@/app/utils/supabase/service'
import { ESPN_PROVIDER, fetchEspnFixtures, type MatchStatus, type ProviderFixture } from '@/app/utils/providers/espn'

type ServiceSupabaseClient = ReturnType<typeof createServiceRoleSupabaseClient>

type EventTarget = {
  eventId: string
  leagueSlug: string
}

type TrackedMatch = {
  event_id: string
  status: string
  next_sync_at: string | null
  scheduled_start_at: string
}

type ExistingMatch = {
  provider_match_id: string
  status: string
  home_score_ft: number | null
  away_score_ft: number | null
}

export type SyncMatchesResult = {
  eventsProcessed: number
  eventsSkipped: number
  matchesUpserted: number
  scoringJobsEnqueued: number
  failures: Array<{ eventId: string; message: string }>
}

const SYNC_WINDOW_PAST_MS = 48 * 60 * 60 * 1000
const SYNC_WINDOW_FUTURE_MS = 10 * 24 * 60 * 60 * 1000

function computeNextSyncAt(status: MatchStatus, scheduledStartAt: string, now: Date) {
  if (status === 'finished' || status === 'cancelled') return null
  if (status === 'live') return new Date(now.getTime() + 5 * 60 * 1000).toISOString()

  const untilKickoff = new Date(scheduledStartAt).getTime() - now.getTime()
  if (untilKickoff <= 2 * 60 * 60 * 1000) return new Date(now.getTime() + 10 * 60 * 1000).toISOString()
  return new Date(now.getTime() + 60 * 60 * 1000).toISOString()
}

function isEventDue(tracked: TrackedMatch[], now: Date) {
  // No upcoming/live matches stored yet: fetch the schedule.
  if (tracked.length === 0) return true

  return tracked.some((match) => {
    if (match.status === 'live') return true
    if (!match.next_sync_at) return true
    // Kickoff passed but we still think it's scheduled: refresh now.
    if (new Date(match.scheduled_start_at).getTime() <= now.getTime()) return true
    return new Date(match.next_sync_at).getTime() <= now.getTime()
  })
}

function toMatchRow(eventId: string, fixture: ProviderFixture, now: Date) {
  return {
    event_id: eventId,
    provider_match_id: fixture.providerMatchId,
    home_team: fixture.homeTeam,
    away_team: fixture.awayTeam,
    home_logo: fixture.homeLogo,
    away_logo: fixture.awayLogo,
    scheduled_start_at: fixture.scheduledStartAt,
    status: fixture.status,
    result_mode: fixture.resultMode,
    home_score_ft: fixture.homeScoreFt,
    away_score_ft: fixture.awayScoreFt,
    home_score_aet: fixture.homeScoreAet,
    away_score_aet: fixture.awayScoreAet,
    home_score_pens: fixture.homeScorePens,
    away_score_pens: fixture.awayScorePens,
    live_minute: fixture.liveMinute,
    last_synced_at: now.toISOString(),
    next_sync_at: computeNextSyncAt(fixture.status, fixture.scheduledStartAt, now),
    sync_error_count: 0,
    last_sync_error: null,
  }
}

export async function finishExpiredRooms(supabase: ServiceSupabaseClient) {
  const nowIso = new Date().toISOString()

  await supabase
    .from('rooms')
    .update({ status: 'finished' })
    .eq('status', 'active')
    .not('room_end_at', 'is', null)
    .lte('room_end_at', nowIso)

  const { data: activeRooms } = await supabase
    .from('rooms')
    .select('id, events!inner(is_active)')
    .eq('status', 'active')
    .eq('events.is_active', false)

  const ids = (activeRooms ?? []).map((row) => row.id)
  if (ids.length > 0) {
    await supabase.from('rooms').update({ status: 'finished' }).in('id', ids)
  }
}

async function loadSyncTargets(supabase: ServiceSupabaseClient, onlyEventIds?: string[]) {
  let query = supabase
    .from('rooms')
    .select('event_id, events!inner(provider, provider_event_id, is_active)')
    .eq('status', 'active')
    .eq('events.provider', ESPN_PROVIDER)
    .eq('events.is_active', true)

  if (onlyEventIds && onlyEventIds.length > 0) {
    query = query.in('event_id', onlyEventIds)
  }

  const { data, error } = await query
  if (error) throw new Error(`Could not load active room events: ${error.message}`)

  const targets = new Map<string, EventTarget>()
  for (const row of data ?? []) {
    const event = Array.isArray(row.events) ? row.events[0] : row.events
    if (!event?.provider_event_id) continue
    targets.set(row.event_id, { eventId: row.event_id, leagueSlug: event.provider_event_id })
  }

  return targets
}

export async function syncMatches(
  supabase: ServiceSupabaseClient,
  options: { eventIds?: string[]; force?: boolean } = {}
): Promise<SyncMatchesResult> {
  const now = new Date()
  const targets = await loadSyncTargets(supabase, options.eventIds)
  const eventIds = [...targets.keys()]

  const { data: trackedRows } = eventIds.length
    ? await supabase
        .from('matches')
        .select('event_id, status, next_sync_at, scheduled_start_at')
        .in('event_id', eventIds)
        .in('status', ['scheduled', 'delayed', 'live'])
        .gte('scheduled_start_at', new Date(now.getTime() - SYNC_WINDOW_PAST_MS).toISOString())
    : { data: [] as TrackedMatch[] }

  const trackedByEvent = new Map<string, TrackedMatch[]>()
  for (const match of (trackedRows ?? []) as TrackedMatch[]) {
    const list = trackedByEvent.get(match.event_id) ?? []
    list.push(match)
    trackedByEvent.set(match.event_id, list)
  }

  const dueTargets = [...targets.values()].filter(
    (target) => options.force || isEventDue(trackedByEvent.get(target.eventId) ?? [], now)
  )

  const from = new Date(now.getTime() - SYNC_WINDOW_PAST_MS)
  const to = new Date(now.getTime() + SYNC_WINDOW_FUTURE_MS)
  const failures: SyncMatchesResult['failures'] = []
  let matchesUpserted = 0
  const jobMatchIds: string[] = []

  for (const target of dueTargets) {
    try {
      const fixtures = await fetchEspnFixtures(target.leagueSlug, from, to)
      if (fixtures.length === 0) continue

      const providerIds = fixtures.map((fixture) => fixture.providerMatchId)
      const { data: existingRows } = await supabase
        .from('matches')
        .select('provider_match_id, status, home_score_ft, away_score_ft')
        .eq('event_id', target.eventId)
        .in('provider_match_id', providerIds)

      const existingById = new Map(
        ((existingRows ?? []) as ExistingMatch[]).map((row) => [row.provider_match_id, row])
      )

      const rows = fixtures.map((fixture) => toMatchRow(target.eventId, fixture, now))
      const { data: upserted, error: upsertError } = await supabase
        .from('matches')
        .upsert(rows, { onConflict: 'event_id,provider_match_id' })
        .select('id, provider_match_id')

      if (upsertError) {
        failures.push({ eventId: target.eventId, message: `Upsert failed: ${upsertError.message}` })
        continue
      }

      matchesUpserted += rows.length
      const idByProviderId = new Map((upserted ?? []).map((row) => [row.provider_match_id, String(row.id)]))

      // (Re)score when a match has just finished or its final score was corrected.
      for (const fixture of fixtures) {
        if (fixture.status !== 'finished') continue
        const previous = existingById.get(fixture.providerMatchId)
        const changed =
          !previous ||
          previous.status !== 'finished' ||
          previous.home_score_ft !== fixture.homeScoreFt ||
          previous.away_score_ft !== fixture.awayScoreFt

        const matchId = idByProviderId.get(fixture.providerMatchId)
        if (changed && matchId) jobMatchIds.push(matchId)
      }
    } catch (error) {
      failures.push({
        eventId: target.eventId,
        message: error instanceof Error ? error.message : 'Unhandled fetch error',
      })
    }
  }

  if (jobMatchIds.length > 0) {
    const nowIso = new Date().toISOString()
    await supabase.from('scoring_jobs').upsert(
      jobMatchIds.map((matchId) => ({
        match_id: matchId,
        status: 'pending',
        attempts: 0,
        last_error: null,
        updated_at: nowIso,
      })),
      { onConflict: 'match_id' }
    )
  }

  return {
    eventsProcessed: dueTargets.length,
    eventsSkipped: targets.size - dueTargets.length,
    matchesUpserted,
    scoringJobsEnqueued: jobMatchIds.length,
    failures,
  }
}
