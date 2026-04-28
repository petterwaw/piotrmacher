import BetsByDay from '@/app/components/BetsByDay'
import { createServerSupabaseClient } from '@/app/utils/supabase/server'
import { createServiceRoleSupabaseClient } from '@/app/utils/supabase/service'

type LivePrediction = {
  username: string
  homeScore: number
  awayScore: number
}

export default async function BetsPage({
  params,
}: {
  params: Promise<{ room_id: string }>
}) {
  const { room_id } = await params
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: room } = await supabase
    .from('rooms')
    .select('status, event_id, created_at, room_end_at')
    .eq('id', room_id)
    .maybeSingle()

  if (!room) {
    return <p className="text-text-muted">Room not found.</p>
  }

  const status = (room?.status as 'waiting' | 'active' | 'finished' | undefined) ?? 'waiting'

  type MatchRow = {
    id: string
    home_team: string
    away_team: string
    scheduled_start_at: string
    status: string
    home_score_ft: number | null
    away_score_ft: number | null
    live_minute?: number | null
  }

  const initialMatchesResult = await supabase
    .from('matches')
    .select('id, home_team, away_team, scheduled_start_at, status, home_score_ft, away_score_ft, live_minute')
    .eq('event_id', room.event_id)
    .gte('scheduled_start_at', room.created_at)
    .lte('scheduled_start_at', room.room_end_at ?? '9999-12-31T23:59:59.999Z')
    .in('status', ['scheduled', 'delayed', 'live'])
    .order('scheduled_start_at', { ascending: true })

  let matches: MatchRow[] = (initialMatchesResult.data ?? []) as MatchRow[]

  if (initialMatchesResult.error?.message?.toLowerCase().includes('live_minute')) {
    const fallbackMatchesResult = await supabase
      .from('matches')
      .select('id, home_team, away_team, scheduled_start_at, status, home_score_ft, away_score_ft')
      .eq('event_id', room.event_id)
      .gte('scheduled_start_at', room.created_at)
      .lte('scheduled_start_at', room.room_end_at ?? '9999-12-31T23:59:59.999Z')
      .in('status', ['scheduled', 'delayed', 'live'])
      .order('scheduled_start_at', { ascending: true })

    matches = (fallbackMatchesResult.data ?? []) as MatchRow[]
  }

  const matchIds = matches.map((match) => match.id)

  const { data: bets } = user && matchIds.length > 0
    ? await supabase
        .from('bets')
        .select('match_id, home_score, away_score')
        .eq('room_id', room_id)
        .eq('user_id', user.id)
        .in('match_id', matchIds)
    : { data: [] }

  const betByMatchId = new Map((bets ?? []).map((bet) => [bet.match_id, bet]))
  const liveMatches = matches.filter((match) => match.status === 'live')

  let livePredictionsByMatchId = new Map<string, LivePrediction[]>()

  if (user && liveMatches.length > 0) {
    const { data: membership } = await supabase
      .from('room_players')
      .select('id')
      .eq('room_id', room_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (membership) {
      const serviceSupabase = createServiceRoleSupabaseClient()
      const liveMatchIds = liveMatches.map((match) => match.id)

      const { data: liveBets } = await serviceSupabase
        .from('bets')
        .select('match_id, user_id, home_score, away_score')
        .eq('room_id', room_id)
        .in('match_id', liveMatchIds)

      const userIds = [...new Set((liveBets ?? []).map((bet) => bet.user_id))]

      const { data: profiles } = userIds.length
        ? await serviceSupabase.from('profiles').select('id, username').in('id', userIds)
        : { data: [] }

      const usernameById = new Map((profiles ?? []).map((profile) => [profile.id, profile.username]))

      const grouped = new Map<string, LivePrediction[]>()

      for (const bet of liveBets ?? []) {
        const current = grouped.get(bet.match_id) ?? []
        current.push({
          username: usernameById.get(bet.user_id) ?? bet.user_id.slice(0, 8),
          homeScore: bet.home_score,
          awayScore: bet.away_score,
        })
        grouped.set(bet.match_id, current)
      }

      livePredictionsByMatchId = grouped
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-text-main mb-6">Available Bets</h2>

      {matches.length === 0 ? (
        <p className="text-text-muted">No upcoming matches for this event.</p>
      ) : (
        <BetsByDay
          roomId={room_id}
          roomStatus={status}
          matches={matches.map((match) => {
            const existingBet = betByMatchId.get(match.id)
            const liveMinute = (match as { live_minute?: number | null }).live_minute ?? null
            const liveHomeScore = (match as { home_score_ft?: number | null }).home_score_ft ?? null
            const liveAwayScore = (match as { away_score_ft?: number | null }).away_score_ft ?? null

            return {
              id: match.id,
              livePredictions: livePredictionsByMatchId.get(match.id) ?? [],
              match: {
                id: match.id,
                homeTeam: match.home_team,
                awayTeam: match.away_team,
                startTime: match.scheduled_start_at,
                status: match.status as 'scheduled' | 'delayed' | 'live' | 'finished' | 'cancelled',
                liveMinute,
                liveScore: {
                  home: liveHomeScore,
                  away: liveAwayScore,
                },
                prediction: existingBet
                  ? {
                      home: existingBet.home_score,
                      away: existingBet.away_score,
                    }
                  : null,
              },
            }
          })}
        />
      )}
    </div>
  )
}