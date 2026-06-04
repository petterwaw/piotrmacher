import { unstable_cache } from 'next/cache'
import { createServiceRoleSupabaseClient } from '@/app/utils/supabase/service'

export type CachedStandingPlayer = {
  username: string
  points: number
}

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
  live_minute?: number | null
}

type CachedRules = {
  correct_winner?: number
  correct_draw?: number
  correct_difference?: number
  correct_away_goals?: number
  correct_home_goals?: number
  exact_score?: number
  exact_draw?: number
} | null

export const getCachedStandingPlayers = unstable_cache(
  async (roomId: string): Promise<CachedStandingPlayer[]> => {
    const supabase = createServiceRoleSupabaseClient()

    const { data: members } = await supabase
      .from('room_players')
      .select('user_id, points')
      .eq('room_id', roomId)

    const memberUserIds = (members ?? []).map((member) => member.user_id)

    const { data: profiles } = memberUserIds.length
      ? await supabase.from('profiles').select('id, username').in('id', memberUserIds)
      : { data: [] }

    const usernameById = new Map((profiles ?? []).map((profile) => [profile.id, profile.username]))

    return (members ?? []).map((member) => ({
      username: usernameById.get(member.user_id) ?? member.user_id.slice(0, 8),
      points: member.points,
    }))
  },
  ['room-standings'],
  { revalidate: 10 }
)

export const getCachedHistoryCount = unstable_cache(
  async (
    eventId: string,
    createdAt: string,
    roomEndAt: string | null,
  ): Promise<number> => {
    const supabase = createServiceRoleSupabaseClient()
    const roomWindowEnd = roomEndAt ?? '9999-12-31T23:59:59.999Z'

    const { count } = await supabase
      .from('matches')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .gte('scheduled_start_at', createdAt)
      .lte('scheduled_start_at', roomWindowEnd)
      .eq('status', 'finished')

    return count ?? 0
  },
  ['room-history-count'],
  { revalidate: 30 }
)

export const getCachedHistoryMatches = unstable_cache(
  async (
    eventId: string,
    createdAt: string,
    roomEndAt: string | null,
    pageStart: number,
    pageEnd: number,
  ): Promise<CachedMatchRow[]> => {
    const supabase = createServiceRoleSupabaseClient()
    const roomWindowEnd = roomEndAt ?? '9999-12-31T23:59:59.999Z'

    const { data: finishedMatches } = await supabase
      .from('matches')
      .select('id, home_team, home_logo, away_team, away_logo, scheduled_start_at, status, home_score_ft, away_score_ft')
      .eq('event_id', eventId)
      .gte('scheduled_start_at', createdAt)
      .lte('scheduled_start_at', roomWindowEnd)
      .eq('status', 'finished')
      .order('scheduled_start_at', { ascending: false })
      .range(pageStart, pageEnd)

    return (finishedMatches ?? []) as CachedMatchRow[]
  },
  ['room-history-matches'],
  { revalidate: 30 }
)

export const getCachedUpcomingMatches = unstable_cache(
  async (eventId: string, createdAt: string, roomEndAt: string | null): Promise<CachedMatchRow[]> => {
    const supabase = createServiceRoleSupabaseClient()
    const roomWindowEnd = roomEndAt ?? '9999-12-31T23:59:59.999Z'

    const initialMatchesResult = await supabase
      .from('matches')
      .select('id, home_team, home_logo, away_team, away_logo, scheduled_start_at, status, home_score_ft, away_score_ft, live_minute')
      .eq('event_id', eventId)
      .gte('scheduled_start_at', createdAt)
      .lte('scheduled_start_at', roomWindowEnd)
      .in('status', ['scheduled', 'delayed', 'live'])
      .order('scheduled_start_at', { ascending: true })

    const initialMatches = (initialMatchesResult.data ?? []) as CachedMatchRow[]
    if (!initialMatchesResult.error?.message?.toLowerCase().includes('live_minute')) {
      return initialMatches
    }

    const fallbackMatchesResult = await supabase
      .from('matches')
      .select('id, home_team, home_logo, away_team, away_logo, scheduled_start_at, status, home_score_ft, away_score_ft')
      .eq('event_id', eventId)
      .gte('scheduled_start_at', createdAt)
      .lte('scheduled_start_at', roomWindowEnd)
      .in('status', ['scheduled', 'delayed', 'live'])
      .order('scheduled_start_at', { ascending: true })

    return (fallbackMatchesResult.data ?? []) as CachedMatchRow[]
  },
  ['room-upcoming-matches'],
  { revalidate: 15 }
)

export const getCachedRoomRules = unstable_cache(
  async (roomId: string): Promise<CachedRules> => {
    const supabase = createServiceRoleSupabaseClient()

    const { data: room } = await supabase
      .from('rooms')
      .select('rules')
      .eq('id', roomId)
      .maybeSingle()

    return (room?.rules as CachedRules) ?? null
  },
  ['room-rules'],
  { revalidate: 300 }
)