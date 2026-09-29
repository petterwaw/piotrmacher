import Link from 'next/link'
import { ChevronLeft, ChevronRight, History } from 'lucide-react'
import EmptyState from '@/app/components/EmptyState'
import { notFound, redirect } from 'next/navigation'
import ScorePredictionCard from '@/app/components/ScorePredictionCard'
import { getCachedHistoryCount, getCachedHistoryMatches } from '@/app/utils/cache/roomReads'
import { createServerSupabaseClient } from '@/app/utils/supabase/server'
import { createServiceRoleSupabaseClient } from '@/app/utils/supabase/service'

const MATCHES_PER_PAGE = 5

const PAGE_ITEM =
  'inline-flex h-11 min-w-11 items-center justify-center border-2 px-2 text-sm font-semibold tabular-nums transition-colors'

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
  points?: number
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
    notFound()
  }

  if (room.status === 'waiting') {
    redirect(`/home/${room_id}/standings`)
  }

  const totalMatches = await getCachedHistoryCount(
    room.event_id,
    room.created_at,
    room.room_end_at,
  )
  const totalPages = Math.max(1, Math.ceil(totalMatches / MATCHES_PER_PAGE))
  const currentPage = Math.min(requestedPage, totalPages)
  const pageStart = (currentPage - 1) * MATCHES_PER_PAGE
  const pageEnd = pageStart + MATCHES_PER_PAGE - 1

  const matches = await getCachedHistoryMatches(
    room.event_id,
    room.created_at,
    room.room_end_at,
    pageStart,
    pageEnd,
  )
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
        .select('match_id, user_id, home_score, away_score, points')
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
          username: usernameById.get(bet.user_id) ?? 'Player',
          homeScore: bet.home_score,
          awayScore: bet.away_score,
          points: bet.points ?? 0,
        })
        grouped.set(bet.match_id, current)
      }

      predictionsByMatchId = grouped
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      {matches.length === 0 ? (
        <EmptyState icon={History} title="No historical bets yet" />
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
            <nav className="mt-6 flex flex-wrap items-center justify-center gap-1.5 sm:gap-2" aria-label="History pages">
              <Link
                href={currentPage > 1 ? `?page=${currentPage - 1}` : '#'}
                aria-disabled={currentPage === 1}
                aria-label="Previous page"
                className={`${PAGE_ITEM} ${
                  currentPage === 1
                    ? 'pointer-events-none border-zinc-200 bg-zinc-100 text-zinc-400'
                    : 'border-zinc-300 bg-white text-text-main hover:border-brand hover:text-brand'
                }`}
              >
                <ChevronLeft size={18} aria-hidden="true" />
              </Link>

              {buildPagination(currentPage, totalPages).map((item, index) => {
                if (item === 'dots') {
                  return (
                    <span key={`dots-${index}`} aria-hidden="true" className="px-1 text-zinc-500">
                      …
                    </span>
                  )
                }

                const isActive = item === currentPage

                return (
                  <Link
                    key={item}
                    href={`?page=${item}`}
                    aria-current={isActive ? 'page' : undefined}
                    aria-label={`Page ${item}`}
                    className={`${PAGE_ITEM} ${
                      isActive
                        ? 'border-brand bg-brand font-bold text-white'
                        : 'border-zinc-300 bg-white text-text-main hover:border-brand hover:text-brand'
                    }`}
                  >
                    {item}
                  </Link>
                )
              })}

              <Link
                href={currentPage < totalPages ? `?page=${currentPage + 1}` : '#'}
                aria-disabled={currentPage === totalPages}
                aria-label="Next page"
                className={`${PAGE_ITEM} ${
                  currentPage === totalPages
                    ? 'pointer-events-none border-zinc-200 bg-zinc-100 text-zinc-400'
                    : 'border-zinc-300 bg-white text-text-main hover:border-brand hover:text-brand'
                }`}
              >
                <ChevronRight size={18} aria-hidden="true" />
              </Link>
            </nav>
          ) : null}
        </div>
      )}
    </div>
  )
}
