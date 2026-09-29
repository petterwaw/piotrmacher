import type { Metadata } from 'next'
import BetsByDay from '@/app/components/BetsByDay'
import EmptyState from '@/app/components/EmptyState'
import { CalendarX2 } from 'lucide-react'
import { notFound, redirect } from 'next/navigation'
import { filterToRoomWindow, getEventFixtures, getRoomPredictions } from '@/app/utils/cache/sharedReads'
import { createServerSupabaseClient } from '@/app/utils/supabase/server'

const VISIBLE_DAYS_AHEAD = 7

type LivePrediction = {
  username: string
  homeScore: number
  awayScore: number
}

export const metadata: Metadata = { title: 'Bets' }

// Identifies this render on the client (see BetsByDay). Each request renders
// once, so the render-time value is exactly what we want.
function renderTimestamp() {
  return Date.now()
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
    .select('status, host_id, event_id, created_at, room_end_at')
    .eq('id', room_id)
    .maybeSingle()

  if (!room) {
    notFound()
  }

  const status = (room?.status as 'waiting' | 'active' | 'finished' | undefined) ?? 'waiting'

  if (status === 'waiting') {
    redirect(user && room.host_id === user.id ? `/home/${room_id}/settings` : `/home/${room_id}/standings`)
  }

  if (status === 'finished') {
    redirect(`/home/${room_id}/standings`)
  }

  // The RLS-scoped room query above is the access check for the shared reads below.
  const matches = filterToRoomWindow(await getEventFixtures(room.event_id), room.created_at, room.room_end_at)

  const matchIds = matches.map((match) => match.id)

  const { data: bets } = user && matchIds.length > 0
    ? await supabase
        .from('bets')
        .select('match_id, home_score, away_score')
        .eq('room_id', room_id)
        .eq('user_id', user.id)
        .in('match_id', matchIds)
    : { data: [] }

  const renderedAt = renderTimestamp()
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
      const liveBets = await getRoomPredictions(room_id, liveMatches.map((match) => match.id))
      const grouped = new Map<string, LivePrediction[]>()

      for (const bet of liveBets) {
        const current = grouped.get(bet.matchId) ?? []
        current.push({
          username: bet.username,
          homeScore: bet.homeScore,
          awayScore: bet.awayScore,
        })
        grouped.set(bet.matchId, current)
      }

      livePredictionsByMatchId = grouped
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="sr-only">Bets</h1>

      {matches.length === 0 ? (
        <EmptyState icon={CalendarX2} title="No upcoming matches for this event." />
      ) : (
        <BetsByDay
          roomId={room_id}
          roomStatus={status}
          visibleDaysAhead={VISIBLE_DAYS_AHEAD}
          renderedAt={renderedAt}
          matches={matches.map((match) => {
            const existingBet = betByMatchId.get(match.id)
            const liveMinute = match.live_minute ?? null
            const liveHomeScore = match.home_score_ft ?? null
            const liveAwayScore = match.away_score_ft ?? null

            return {
              id: match.id,
              livePredictions: livePredictionsByMatchId.get(match.id) ?? [],
              match: {
                id: match.id,
                homeTeam: match.home_team,
                homeLogo: match.home_logo,
                awayTeam: match.away_team,
                awayLogo: match.away_logo,
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