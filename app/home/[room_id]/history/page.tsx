import Link from 'next/link'
import ScorePredictionCard from '@/app/components/ScorePredictionCard'
import { createServerSupabaseClient } from '@/app/utils/supabase/server'
import { createServiceRoleSupabaseClient } from '@/app/utils/supabase/service'

const MATCHES_PER_PAGE = 5

function buildPagination(currentPage: number, totalPages: number): Array<number | 'dots'> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  let start = currentPage - 1
  let end = currentPage + 1

  if (currentPage <= 3) {
    start = 2
    end = 4
  }

  if (currentPage >= totalPages - 2) {
    start = totalPages - 3
    end = totalPages - 1
  }

  const items: Array<number | 'dots'> = [1]

  if (start > 2) {
    items.push('dots')
  }

  for (let page = start; page <= end; page += 1) {
    if (page > 1 && page < totalPages) {
      items.push(page)
    }
  }

  if (end < totalPages - 1) {
    items.push('dots')
  }

  items.push(totalPages)

  return items
}

type LivePrediction = {
  username: string
  homeScore: number
  awayScore: number
}

export default async function HistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ room_id: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { room_id } = await params
  const resolvedSearchParams = await searchParams
  const supabase = await createServerSupabaseClient()

  const rawPage = resolvedSearchParams.page
  const pageValue = Array.isArray(rawPage) ? rawPage[0] : rawPage
  const parsedPage = Number.parseInt(pageValue ?? '1', 10)
  const requestedPage = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1

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
    home_logo: string | null
    away_team: string
    away_logo: string | null
    scheduled_start_at: string
    status: string
    home_score_ft: number | null
    away_score_ft: number | null
  }

  const { count: finishedMatchesCount } = await supabase
    .from('matches')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', room.event_id)
    .gte('scheduled_start_at', room.created_at)
    .lte('scheduled_start_at', room.room_end_at ?? '9999-12-31T23:59:59.999Z')
    .eq('status', 'finished')

  const totalMatches = finishedMatchesCount ?? 0
  const totalPages = Math.max(1, Math.ceil(totalMatches / MATCHES_PER_PAGE))
  const currentPage = Math.min(requestedPage, totalPages)
  const pageStart = (currentPage - 1) * MATCHES_PER_PAGE
  const pageEnd = pageStart + MATCHES_PER_PAGE - 1

  const { data: finishedMatches } = await supabase
    .from('matches')
    .select('id, home_team, home_logo, away_team, away_logo, scheduled_start_at, status, home_score_ft, away_score_ft')
    .eq('event_id', room.event_id)
    .gte('scheduled_start_at', room.created_at)
    .lte('scheduled_start_at', room.room_end_at ?? '9999-12-31T23:59:59.999Z')
    .eq('status', 'finished')
    .order('scheduled_start_at', { ascending: false })
    .range(pageStart, pageEnd)

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
    <div className="mx-auto max-w-xl">
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
                  homeLogo: match.home_logo,
                  awayTeam: match.away_team,
                  awayLogo: match.away_logo,
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

          {totalPages > 1 ? (
            <nav className="mt-6 flex items-center justify-center gap-2" aria-label="History pages">
              <Link
                href={currentPage > 1 ? `?page=${currentPage - 1}` : '#'}
                aria-disabled={currentPage === 1}
                className={`px-3 py-2 text-sm font-medium border border-border-soft transition-colors ${
                  currentPage === 1
                    ? 'pointer-events-none text-text-muted/50 bg-zinc-100'
                    : 'text-text-main bg-white hover:bg-zinc-100'
                }`}
              >
                &lt;
              </Link>

              {buildPagination(currentPage, totalPages).map((item, index) => {
                if (item === 'dots') {
                  return (
                    <span key={`dots-${index}`} className="px-2 py-2 text-text-muted">
                      ...
                    </span>
                  )
                }

                const isActive = item === currentPage

                return (
                  <Link
                    key={item}
                    href={`?page=${item}`}
                    aria-current={isActive ? 'page' : undefined}
                    className={`min-w-9 px-3 py-2 text-center text-sm font-medium border border-border-soft transition-colors ${
                      isActive
                        ? 'bg-white text-brand'
                        : 'bg-white text-text-main hover:bg-zinc-100'
                    }`}
                  >
                    {item}
                  </Link>
                )
              })}

              <Link
                href={currentPage < totalPages ? `?page=${currentPage + 1}` : '#'}
                aria-disabled={currentPage === totalPages}
                className={`px-3 py-2 text-sm font-medium border border-border-soft transition-colors ${
                  currentPage === totalPages
                    ? 'pointer-events-none text-text-muted/50 bg-zinc-100'
                    : 'text-text-main bg-white hover:bg-zinc-100'
                }`}
              >
                &gt;
              </Link>
            </nav>
          ) : null}
        </div>
      )}
    </div>
  )
}
