import 'server-only'
import { unstable_cache } from 'next/cache'
import { createServiceRoleSupabaseClient } from '@/app/utils/supabase/service'
import { cacheTags } from './tags'

// Shared, cross-request cache for data that is identical for every viewer and
// changes only through the scheduled tick or our own API routes. Entries live
// long and are invalidated on demand by tag (see ./tags.ts and the callers of
// invalidateCacheTags). The TTLs below are only a safety net for writes made
// outside the app (e.g. manual edits in the Supabase dashboard).
//
// Reads use the service-role client, so callers MUST run their access check
// (RLS-scoped room query / membership check) BEFORE calling any room-scoped
// reader here. Nothing per-viewer (own bets, own picks, room lists) is cached.
//
// Why unstable_cache and not 'use cache': see the note at the bottom.

const HOUR = 60 * 60
const DAY = 24 * HOUR

// Bump when a cached return shape changes: unstable_cache entries survive
// deploys (on Vercel they live in the Data Cache).
const CACHE_VERSION = 'v2'

const MATCH_COLUMNS =
  'id, home_team, home_logo, away_team, away_logo, scheduled_start_at, status, home_score_ft, away_score_ft, live_minute'

export type CachedMatchRow = {
  id: string
  home_team: string
  home_logo: string | null
  away_team: string
  away_logo: string | null
  scheduled_start_at: string
  status: string
  home_score_ft: number | null
  away_score_ft: number | null
  live_minute: number | null
}

export type CachedStandingPlayer = {
  username: string
  points: number
}

export type CachedPrediction = {
  matchId: string
  username: string
  homeScore: number
  awayScore: number
  points: number | null
}

export type CachedActiveEvent = {
  id: string
  name: string
  season: string
  displayName: string
}

// Failures are thrown inside the cached function (so they are never stored)
// and turned into an uncached fallback here, matching the old "render empty"
// behaviour on a transient database error.
async function readThrough<T>(
  label: string,
  keyParts: string[],
  tags: string[],
  revalidate: number,
  fallback: T,
  load: () => Promise<T>,
): Promise<T> {
  try {
    return await unstable_cache(load, [CACHE_VERSION, label, ...keyParts], { tags, revalidate })()
  } catch (error) {
    console.error(`[cache] ${label} failed:`, error)
    return fallback
  }
}

function fail(label: string, error: { message: string }): never {
  throw new Error(`${label}: ${error.message}`)
}

const OPEN_WINDOW_END = '9999-12-31T23:59:59.999Z'

// Rooms only see matches kicking off inside [created_at, room_end_at]. Event
// lists are cached once per event and narrowed per room here, so every room on
// the same event shares one entry.
export function filterToRoomWindow<T extends { scheduled_start_at: string }>(
  matches: T[],
  roomCreatedAt: string,
  roomEndAt: string | null,
) {
  const from = new Date(roomCreatedAt).getTime()
  const to = new Date(roomEndAt ?? OPEN_WINDOW_END).getTime()
  return matches.filter((match) => {
    const kickoff = new Date(match.scheduled_start_at).getTime()
    return kickoff >= from && kickoff <= to
  })
}

// Scheduled / delayed / live matches of an event, kickoff ascending.
// Invalidated by syncMatches whenever a displayed column of such a row changes
// (including live score/minute), i.e. at most once per tick.
export function getEventFixtures(eventId: string) {
  return readThrough('event-fixtures', [eventId], [cacheTags.eventFixtures(eventId)], HOUR, [] as CachedMatchRow[], async () => {
    const { data, error } = await createServiceRoleSupabaseClient()
      .from('matches')
      .select(MATCH_COLUMNS)
      .eq('event_id', eventId)
      .in('status', ['scheduled', 'delayed', 'live'])
      .order('scheduled_start_at', { ascending: true })

    if (error) fail('event-fixtures', error)
    return (data ?? []) as CachedMatchRow[]
  })
}

// Finished matches of an event, most recent first. Invalidated by syncMatches
// when a match finishes or a final score is corrected.
export function getEventResults(eventId: string) {
  return readThrough('event-results', [eventId], [cacheTags.eventResults(eventId)], DAY, [] as CachedMatchRow[], async () => {
    const { data, error } = await createServiceRoleSupabaseClient()
      .from('matches')
      .select(MATCH_COLUMNS)
      .eq('event_id', eventId)
      .eq('status', 'finished')
      .order('scheduled_start_at', { ascending: false })

    if (error) fail('event-results', error)
    return (data ?? []) as CachedMatchRow[]
  })
}

// Room leaderboard. Invalidated by scoring (recomputeRoomPoints), join, leave,
// room deletion and username changes / account deletion (users tag).
// Caller must have verified room access.
export function getRoomStandings(roomId: string) {
  return readThrough(
    'room-standings',
    [roomId],
    [cacheTags.roomStandings(roomId), cacheTags.users],
    DAY,
    [] as CachedStandingPlayer[],
    async () => {
      const supabase = createServiceRoleSupabaseClient()
      const { data: members, error } = await supabase
        .from('room_players')
        .select('user_id, points')
        .eq('room_id', roomId)

      if (error) fail('room-standings', error)

      const usernameById = await loadUsernames((members ?? []).map((member) => member.user_id))

      return (members ?? []).map((member) => ({
        username: usernameById.get(member.user_id) ?? 'Player',
        points: member.points,
      }))
    },
  )
}

// Every member's prediction for the given matches of a room. Only rows for
// matches that already started (live / finished) are ever returned, so other
// players' picks for upcoming matches can't leak even if a caller passes the
// wrong ids. Those bets can no longer change except for `points`, which
// scoring invalidates. Caller must have verified room membership.
export function getRoomPredictions(roomId: string, matchIds: string[]) {
  const ids = [...new Set(matchIds)].sort()
  if (ids.length === 0) return Promise.resolve([] as CachedPrediction[])

  return readThrough(
    'room-predictions',
    [roomId, ids.join(',')],
    [cacheTags.roomBets(roomId), cacheTags.users],
    DAY,
    [] as CachedPrediction[],
    async () => {
      const { data: bets, error } = await createServiceRoleSupabaseClient()
        .from('bets')
        .select('match_id, user_id, home_score, away_score, points, matches!inner(status)')
        .eq('room_id', roomId)
        .in('match_id', ids)
        .in('matches.status', ['live', 'finished'])

      if (error) fail('room-predictions', error)

      const usernameById = await loadUsernames((bets ?? []).map((bet) => bet.user_id))

      return (bets ?? []).map((bet) => ({
        matchId: String(bet.match_id),
        username: usernameById.get(bet.user_id) ?? 'Player',
        homeScore: bet.home_score,
        awayScore: bet.away_score,
        points: bet.points,
      }))
    },
  )
}

// Events offered in the room event picker. Invalidated when the daily job
// deactivates events; events are created by hand in the database, so a new
// one shows up within the hourly TTL (or after a redeploy with a new
// CACHE_VERSION).
export function getActiveEventsCached() {
  return readThrough('active-events', [], [cacheTags.activeEvents], HOUR, [] as CachedActiveEvent[], async () => {
    const { data, error } = await createServiceRoleSupabaseClient()
      .from('events')
      .select('id, name, season')
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (error) fail('active-events', error)

    return (data ?? []).map((event) => ({
      id: event.id,
      name: event.name,
      season: event.season,
      displayName: `${event.name} (${event.season})`,
    }))
  })
}

async function loadUsernames(userIds: string[]) {
  const ids = [...new Set(userIds)]
  if (ids.length === 0) return new Map<string, string>()

  const { data, error } = await createServiceRoleSupabaseClient()
    .from('profiles')
    .select('id, username')
    .in('id', ids)

  if (error) fail('usernames', error)
  return new Map((data ?? []).map((profile) => [profile.id as string, profile.username as string]))
}

// Why unstable_cache: the Next 16 replacement ('use cache' / 'use cache:
// remote' + cacheTag/cacheLife) requires `cacheComponents: true`, which turns
// the whole app into Partial Prerendering and currently fails `next build`
// (root layout's Header/AppFooter read usePathname() and every room page reads
// cookies outside <Suspense>). Every page here is per-user and dynamic anyway,
// so a prerendered shell buys nothing, and plain 'use cache' is an in-memory,
// per-instance cache on serverless. unstable_cache stores entries in the
// platform data cache (shared across instances, tag invalidation is global),
// which is exactly what these request-time reads need. Tags and lifetimes are
// kept in one place so switching to 'use cache: remote' later is mechanical.
