import ScorePredictionCard from '@/app/components/ScorePredictionCard'
import { createServerSupabaseClient } from '@/app/utils/supabase/server'
import { createServiceRoleSupabaseClient } from '@/app/utils/supabase/service'

type LivePrediction = {
  username: string
  homeScore: number
  awayScore: number
}

export default async function HistoryPage({
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

  type MatchRow = {
    id: string
    home_team: string
    away_team: string
    scheduled_start_at: string
    status: string
    home_score_ft: number | null
    away_score_ft: number | null
  }

  const { data: finishedMatches } = await supabase
    .from('matches')
    .select('id, home_team, away_team, scheduled_start_at, status, home_score_ft, away_score_ft')
    .eq('event_id', room.event_id)
    .gte('scheduled_start_at', room.created_at)
    .lte('scheduled_start_at', room.room_end_at ?? '9999-12-31T23:59:59.999Z')
    .eq('status', 'finished')
    .order('scheduled_start_at', { ascending: false })

  const matches = (finishedMatches ?? []) as MatchRow[]
  const matchIds = matches.map((match) => match.id)

  const { data: userBets } = user && matchIds.length > 0
    ? await supabase
        .from('bets')
        .select('match_id, home_score, away_score')
        .eq('room_id', room_id)
        .eq('user_id', user.id)
        .in('match_id', matchIds)
    : { data: [] }

  const userBetByMatchId = new Map((userBets ?? []).map((bet) => [bet.match_id, bet]))

  let predictionsByMatchId = new Map<string, LivePrediction[]>()

  if (user && matchIds.length > 0) {
    const { data: membership } = await supabase
      .from('room_players')
      .select('id')
      .eq('room_id', room_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (membership) {
      const serviceSupabase = createServiceRoleSupabaseClient()

      const { data: roomBets } = await serviceSupabase
        .from('bets')
        .select('match_id, user_id, home_score, away_score')
        .eq('room_id', room_id)
        .in('match_id', matchIds)

      const userIds = [...new Set((roomBets ?? []).map((bet) => bet.user_id))]

      const { data: profiles } = userIds.length
        ? await serviceSupabase.from('profiles').select('id, username').in('id', userIds)
        : { data: [] }

      const usernameById = new Map((profiles ?? []).map((profile) => [profile.id, profile.username]))
      const grouped = new Map<string, LivePrediction[]>()

      for (const bet of roomBets ?? []) {
        const current = grouped.get(bet.match_id) ?? []
        current.push({
          username: usernameById.get(bet.user_id) ?? bet.user_id.slice(0, 8),
          homeScore: bet.home_score,
          awayScore: bet.away_score,
        })
        grouped.set(bet.match_id, current)
      }

      predictionsByMatchId = grouped
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-text-main mb-6">Betting History</h2>
      {matches.length === 0 ? (
        <div className="text-center py-12 text-text-muted">
          <p>No historical bets yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {matches.map((match) => {
            const userBet = userBetByMatchId.get(match.id)

            return (
              <ScorePredictionCard
                key={match.id}
                roomId={room_id}
                roomStatus={room.status as 'waiting' | 'active' | 'finished'}
                livePredictions={predictionsByMatchId.get(match.id) ?? []}
                match={{
                  id: match.id,
                  homeTeam: match.home_team,
                  awayTeam: match.away_team,
                  startTime: match.scheduled_start_at,
                  status: 'finished',
                  liveMinute: null,
                  liveScore: {
                    home: match.home_score_ft,
                    away: match.away_score_ft,
                  },
                  prediction: userBet
                    ? {
                        home: userBet.home_score,
                        away: userBet.away_score,
                      }
                    : null,
                }}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
