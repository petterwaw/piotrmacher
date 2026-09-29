'use client'

import { useEffect, useId, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronDown, LoaderCircle, Minus, Pencil, Plus } from 'lucide-react'
import TickNumber from '@/app/components/motion/TickNumber'
import { useSmoothHeight } from '@/app/components/motion/useLayoutMotion'

type MatchStatus = 'scheduled' | 'delayed' | 'live' | 'finished' | 'cancelled'

type Prediction = {
  home: number
  away: number
}

type LivePrediction = {
  username: string
  homeScore: number
  awayScore: number
  points?: number
}

export type BasicMatch = {
  id: string
  homeTeam: string
  homeLogo?: string | null
  awayTeam: string
  awayLogo?: string | null
  startTime: string
  status: MatchStatus
  liveMinute?: number | null
  liveScore?: {
    home: number | null
    away: number | null
  }
  prediction: Prediction | null
}

type ScorePredictionCardProps = {
  roomId: string
  match: BasicMatch
  livePredictions?: LivePrediction[]
  roomStatus?: 'waiting' | 'active' | 'finished'
  // The page was shown from cache and a fresh live score is on its way.
  scoreLoading?: boolean
}

const MAX_PREDICTED_GOALS = 20

// Score steppers: 40px visual, 44px+ hit area via .touch-target.
const STEP_BASE =
  'touch-target inline-flex h-10 w-10 items-center justify-center border-2 transition-colors disabled:opacity-40'
const STEP_UP = `${STEP_BASE} border-brand bg-brand text-white hover:border-brand-hover hover:bg-brand-hover active:bg-brand-hover disabled:hover:border-brand disabled:hover:bg-brand`
const STEP_DOWN = `${STEP_BASE} border-zinc-300 bg-white text-text-main hover:border-zinc-500 active:bg-zinc-100 disabled:hover:border-zinc-300`
// Team crests bleed off the card's outer edges and fade out toward the centre,
// like the edges of the day strip.
// Each crest fills roughly a third of the card: oversized, zoomed in, cut off by
// the card edge and by the divider above the footer, fading toward the score.
const LOGO_BASE =
  'pointer-events-none absolute top-1/2 aspect-square w-[62%] max-w-none -translate-y-1/2 scale-[1.4] select-none object-contain opacity-40'
const HOME_LOGO_MASK = 'linear-gradient(to right, #000 30%, transparent 85%)'
const AWAY_LOGO_MASK = 'linear-gradient(to left, #000 30%, transparent 85%)'
const SECONDARY_ACTION =
  'inline-flex min-h-11 items-center justify-center gap-2 border-2 border-zinc-300 bg-white px-5 py-2 text-sm font-semibold text-text-main transition-colors hover:border-brand hover:text-brand active:bg-brand-tint disabled:opacity-60'

function getStatusLabel(status: MatchStatus) {
  if (status === 'scheduled') return 'Scheduled'
  if (status === 'delayed') return 'Delayed'
  if (status === 'live') return 'Live'
  if (status === 'cancelled') return 'Cancelled'
  return 'Finished'
}

export default function ScorePredictionCard({
  roomId,
  match,
  livePredictions = [],
  roomStatus = 'waiting',
  scoreLoading = false,
}: ScorePredictionCardProps) {
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [homeScore, setHomeScore] = useState(0)
  const [awayScore, setAwayScore] = useState(0)
  const [savedPrediction, setSavedPrediction] = useState<Prediction | null>(match.prediction)
  const [error, setError] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [showBets, setShowBets] = useState(false)
  const cardRef = useRef<HTMLElement>(null)
  const editButtonRef = useRef<HTMLButtonElement>(null)
  const firstStepperRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const betsListId = useId()
  // True once the user has toggled edit mode: from then on the swapped-in
  // score / buttons fade in. Never true on first render or data refreshes.
  const [hasToggled, setHasToggled] = useState(false)
  const swapIn = hasToggled ? 'animate-message-in' : ''

  // Score <-> steppers changes the card's height: glide instead of jumping.
  useSmoothHeight(cardRef, isEditing)

  // The Edit / Cancel buttons unmount when edit mode toggles; keep keyboard
  // focus in the card (first stepper on edit, Edit button after cancel/save)
  // instead of dropping it to the page. Only when focus was lost or is
  // already inside this card, so refreshes never steal focus.
  useEffect(() => {
    if (!hasToggled) return
    const active = document.activeElement
    if (active && active !== document.body && !cardRef.current?.contains(active)) return
    if (isEditing) firstStepperRef.current?.focus()
    else editButtonRef.current?.focus()
  }, [isEditing, hasToggled])

  useEffect(() => {
    if (!saveMessage) {
      return
    }

    const timer = window.setTimeout(() => {
      setSaveMessage(null)
    }, 1500)

    return () => {
      window.clearTimeout(timer)
    }
  }, [saveMessage])

  const isStarted = match.status === 'live' || match.status === 'finished' || match.status === 'cancelled' || new Date(match.startTime).getTime() <= Date.now()
  const isRoomActive = roomStatus === 'active'
  const canEdit = isRoomActive && !isStarted

  const statusClassName = useMemo(() => {
    if (match.status === 'live') return 'bg-green-100 text-green-900'
    if (match.status === 'finished') return 'bg-zinc-200 text-zinc-700'
    if (match.status === 'delayed') return 'bg-orange-100 text-orange-900'
    return 'bg-blue-100 text-blue-900'
  }, [match.status])

  const decreaseHome = () => setHomeScore((prev) => Math.max(0, prev - 1))
  const increaseHome = () => setHomeScore((prev) => Math.min(MAX_PREDICTED_GOALS, prev + 1))

  const decreaseAway = () => setAwayScore((prev) => Math.max(0, prev - 1))
  const increaseAway = () => setAwayScore((prev) => Math.min(MAX_PREDICTED_GOALS, prev + 1))

  const startEditing = () => {
    if (!canEdit) return
    setError(null)
    setSaveMessage(null)
    setHasToggled(true)
    setIsEditing(true)
    setHomeScore(0)
    setAwayScore(0)
  }

  const cancelEditing = () => {
    setHasToggled(true)
    setError(null)
    setSaveMessage(null)
    setIsEditing(false)
  }

  const handleSave = () => {
    setError(null)
    setSaveMessage(null)

    const optimisticPrediction = { home: homeScore, away: awayScore }
    const previousPrediction = savedPrediction

    // Optimistic update: show the new score immediately in the card.
    setSavedPrediction(optimisticPrediction)
    setHasToggled(true)
    setIsEditing(false)

    startTransition(async () => {
      try {
        const response = await fetch(`/api/rooms/${roomId}/bets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ matchId: match.id, homeScore, awayScore }),
        })

        const data = (await response.json().catch(() => ({}))) as {
          error?: string
          bet?: { homeScore: number; awayScore: number }
        }

        if (!response.ok || !data.bet) {
          throw new Error(data.error || 'Could not save bet.')
        }

        setSavedPrediction({ home: data.bet.homeScore, away: data.bet.awayScore })
        setSaveMessage('Saved.')
        router.refresh()
      } catch (saveError) {
        setSavedPrediction(previousPrediction)
        setHomeScore(optimisticPrediction.home)
        setAwayScore(optimisticPrediction.away)
        setIsEditing(true)
        setError(saveError instanceof Error ? saveError.message : 'Could not save bet.')
      }
    })
  }

  const showOfficialScore =
    (match.status === 'live' || match.status === 'finished') &&
    typeof match.liveScore?.home === 'number' &&
    typeof match.liveScore?.away === 'number'

  // Only in-play matches wait for the fresh score; upcoming ones keep the
  // cached pick and finished ones are no longer on this page.
  const isScoreLoading = scoreLoading && isStarted && match.status !== 'cancelled'
  const showPlayerPredictionInCenter = !isStarted && !isEditing && savedPrediction
  // The transition stays pending through the follow-up refresh; once the save
  // is confirmed, "Saved." takes over from "Saving…".
  const isSaving = isPending && !saveMessage

  return (
    <article ref={cardRef} aria-labelledby={titleId} className="relative overflow-hidden border-2 border-zinc-300 bg-white/90 p-4 sm:p-5">
      <h2 id={titleId} className="sr-only">
        {match.homeTeam} vs {match.awayTeam}
      </h2>
      {/* Crest area: clipped by the card edges and by the footer divider below. */}
      <div className="relative -mx-4 -mt-4 -mb-4 overflow-hidden px-4 pt-4 pb-4 sm:-mx-5 sm:-mt-5 sm:px-5 sm:pt-5">
      {match.homeLogo ? (
        <img
          src={match.homeLogo}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          style={{ maskImage: HOME_LOGO_MASK, WebkitMaskImage: HOME_LOGO_MASK }}
          className={`${LOGO_BASE} -left-[22%]`}
        />
      ) : null}
      {match.awayLogo ? (
        <img
          src={match.awayLogo}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          style={{ maskImage: AWAY_LOGO_MASK, WebkitMaskImage: AWAY_LOGO_MASK }}
          className={`${LOGO_BASE} -right-[22%]`}
        />
      ) : null}

      <div className="relative z-10 mb-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div />
        <p lang="pl" className="text-center text-sm tabular-nums text-zinc-600">
          {new Date(match.startTime).toLocaleString('pl-PL', {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
        </p>
        <div className="flex justify-end">
          <span className={`status-chip ${statusClassName}`}>
            {getStatusLabel(match.status)}
          </span>
        </div>
      </div>

      {match.status === 'live' ? (
        <div className="mb-3 flex items-center justify-center gap-2 text-sm font-bold tabular-nums text-brand">
          <span aria-hidden="true" className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-brand-bright opacity-75 motion-safe:animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-brand" />
          </span>
          {isScoreLoading ? (
            <>
              <span aria-hidden="true">LIVE</span>
              <span aria-hidden="true" className="inline-block h-4 w-7 bg-zinc-200/80 motion-safe:animate-pulse" />
              <span className="sr-only">Live</span>
            </>
          ) : (
            <>
              <span aria-hidden="true">LIVE{typeof match.liveMinute === 'number' ? ` ${match.liveMinute}'` : ''}</span>
              <span className="sr-only">Live{typeof match.liveMinute === 'number' ? `, minute ${match.liveMinute}` : ''}</span>
            </>
          )}
        </div>
      ) : null}

      <div className="relative flex min-h-24 flex-nowrap items-center justify-between gap-2 py-1 sm:min-h-28 sm:gap-3">
        <div className="relative flex w-[38%] min-w-0 flex-col items-center pl-8 text-center sm:pl-10">
          <p className="text-sm font-bold leading-snug text-text-main">{match.homeTeam}</p>
        </div>

        <div className="relative w-[24%] min-w-[112px] text-center">
          {!isEditing ? (
            <div key="score" className={`flex flex-col items-center ${swapIn}`}>
              <p className="sr-only">
                {isScoreLoading
                  ? 'Loading score'
                  : showOfficialScore
                    ? `Score: ${match.homeTeam} ${match.liveScore?.home ?? 0}, ${match.awayTeam} ${match.liveScore?.away ?? 0}`
                    : showPlayerPredictionInCenter
                      ? `Your pick: ${match.homeTeam} ${savedPrediction.home}, ${match.awayTeam} ${savedPrediction.away}`
                      : 'No pick yet'}
              </p>
              <div aria-hidden="true" className="text-4xl font-black leading-none tracking-tight tabular-nums text-text-main">
                {isScoreLoading ? (
                  <span className="flex items-center justify-center">
                    <span className="inline-block h-9 w-7 bg-zinc-200/80 motion-safe:animate-pulse" />
                    <span className="mx-1.5 text-zinc-300">:</span>
                    <span className="inline-block h-9 w-7 bg-zinc-200/80 motion-safe:animate-pulse" />
                  </span>
                ) : showOfficialScore ? (
                  <span>
                    <TickNumber value={match.liveScore?.home ?? 0} />
                    <span className="mx-1.5 text-zinc-400">:</span>
                    <TickNumber value={match.liveScore?.away ?? 0} />
                  </span>
                ) : showPlayerPredictionInCenter ? (
                  <span>
                    <TickNumber value={savedPrediction.home} />
                    <span className="mx-1.5 text-zinc-400">:</span>
                    <TickNumber value={savedPrediction.away} />
                  </span>
                ) : (
                  <span className="text-zinc-300">
                    –<span className="mx-1.5">:</span>–
                  </span>
                )}
              </div>
              {!showOfficialScore && showPlayerPredictionInCenter ? (
                <span aria-hidden="true" className="mt-1.5 text-[11px] font-bold uppercase tracking-wide text-zinc-600">Your pick</span>
              ) : null}
            </div>
          ) : (
            <div
              key="steppers"
              role="group"
              aria-label={`Your pick for ${match.homeTeam} vs ${match.awayTeam}`}
              className="animate-message-in grid grid-cols-[40px_auto_40px] items-center justify-center gap-2"
            >
              {/* One concise announcement per change: "Arsenal 2, Chelsea 1". */}
              <span aria-live="polite" className="sr-only">
                {`${match.homeTeam} ${homeScore}, ${match.awayTeam} ${awayScore}`}
              </span>
              <div className="flex flex-col items-center gap-1.5">
                <button
                  ref={firstStepperRef}
                  type="button"
                  aria-label={`${match.homeTeam} goals, increase`}
                  className={STEP_UP}
                  onClick={increaseHome}
                  disabled={isPending || homeScore >= MAX_PREDICTED_GOALS}
                >
                  <Plus size={18} strokeWidth={3} aria-hidden="true" />
                </button>
                <span className="w-10 overflow-hidden text-center text-3xl font-black leading-none tabular-nums text-text-main"><TickNumber value={homeScore} /></span>
                <button
                  type="button"
                  aria-label={`${match.homeTeam} goals, decrease`}
                  className={STEP_DOWN}
                  onClick={decreaseHome}
                  disabled={isPending || homeScore <= 0}
                >
                  <Minus size={18} strokeWidth={3} aria-hidden="true" />
                </button>
              </div>

              <div aria-hidden="true" className="text-2xl font-black text-zinc-400">:</div>

              <div className="flex flex-col items-center gap-1.5">
                <button
                  type="button"
                  aria-label={`${match.awayTeam} goals, increase`}
                  className={STEP_UP}
                  onClick={increaseAway}
                  disabled={isPending || awayScore >= MAX_PREDICTED_GOALS}
                >
                  <Plus size={18} strokeWidth={3} aria-hidden="true" />
                </button>
                <span className="w-10 overflow-hidden text-center text-3xl font-black leading-none tabular-nums text-text-main"><TickNumber value={awayScore} /></span>
                <button
                  type="button"
                  aria-label={`${match.awayTeam} goals, decrease`}
                  className={STEP_DOWN}
                  onClick={decreaseAway}
                  disabled={isPending || awayScore <= 0}
                >
                  <Minus size={18} strokeWidth={3} aria-hidden="true" />
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="relative flex w-[38%] min-w-0 flex-col items-center pr-8 text-center sm:pr-10">
          <p className="text-sm font-bold leading-snug text-text-main">{match.awayTeam}</p>
        </div>
      </div>

      </div>

      {error ? <p role="alert" className="animate-message-in mt-3 text-center text-sm font-medium text-danger">{error}</p> : null}

      {canEdit ? (
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-zinc-200 pt-4">
          {/* Save status: "Saving…" while the request runs, then "Saved." with a
              check. Both sit in one grid cell so they crossfade without shifting. */}
          <span role="status" className="sr-only">
            {isSaving ? 'Saving your pick…' : saveMessage ? 'Your pick is saved.' : ''}
          </span>
          <span aria-hidden="true" className="grid min-w-[80px] text-sm font-semibold">
            <span
              className={`col-start-1 row-start-1 inline-flex items-center gap-1.5 text-zinc-600 transition-[opacity,translate] duration-150 ${
                isSaving ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-1 opacity-0'
              }`}
            >
              <LoaderCircle size={15} strokeWidth={2.5} aria-hidden="true" className="motion-safe:animate-spin" />
              {isSaving ? 'Saving…' : null}
            </span>
            <span
              className={`col-start-1 row-start-1 inline-flex items-center gap-1 text-brand transition-[opacity,translate] duration-[220ms] ${
                saveMessage ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-1 opacity-0'
              }`}
            >
              <Check key={saveMessage ?? 'idle'} size={16} strokeWidth={3} aria-hidden="true" className={saveMessage ? 'animate-check-in' : ''} />
              {saveMessage ?? 'Saved.'}
            </span>
          </span>

          <div className="flex items-center justify-end gap-2 sm:gap-3">
            {!isEditing ? (
              <button
                key="edit"
                ref={editButtonRef}
                type="button"
                className={`${SECONDARY_ACTION} ${swapIn}`}
                onClick={startEditing}
                disabled={isPending}
              >
                <Pencil size={14} aria-hidden="true" />
                Edit
                <span className="sr-only"> pick for {match.homeTeam} vs {match.awayTeam}</span>
              </button>
            ) : (
              <>
                <button
                  key="cancel"
                  type="button"
                  className={`${SECONDARY_ACTION} animate-message-in`}
                  onClick={cancelEditing}
                  disabled={isPending}
                >
                  Cancel
                </button>
                <button
                  key="save"
                  type="button"
                  className="animate-message-in inline-flex min-h-11 items-center justify-center gap-2 border-2 border-brand bg-brand px-5 py-2 text-sm font-semibold text-white transition-colors hover:border-brand-hover hover:bg-brand-hover active:bg-brand-hover disabled:opacity-60"
                  onClick={handleSave}
                  disabled={isPending}
                >
                  {isPending ? 'Saving…' : 'Save'}
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}

      {/* Collapsible other players' bets */}
      {livePredictions.length > 0 ? (
        <div className="mt-4 border-t-2 border-zinc-200">
          <button
            type="button"
            onClick={() => setShowBets((prev) => !prev)}
            aria-expanded={showBets}
            aria-controls={betsListId}
            className="no-press flex min-h-11 w-full items-center justify-between gap-2 pt-1 text-sm font-semibold text-zinc-700 transition-colors hover:text-text-main active:text-brand"
          >
            <span>
              Players bets <span className="tabular-nums text-zinc-500">({livePredictions.length})</span>
            </span>
            <ChevronDown
              size={18}
              aria-hidden="true"
              className={`text-zinc-500 transition-transform duration-[220ms] ${showBets ? 'rotate-180' : ''}`}
            />
          </button>
          <div id={betsListId} className="collapsible" data-open={showBets}>
            <ul className="divide-y divide-zinc-100">
              {livePredictions.map((item) => (
                <li key={`${item.username}-${item.homeScore}-${item.awayScore}`} className="flex items-center justify-between gap-3 py-2 text-sm text-text-main">
                  <span className="min-w-0 truncate">{item.username}</span>
                  <span className="flex shrink-0 items-center gap-2 font-semibold tabular-nums">
                    <span className="w-12 text-center">{item.homeScore} : {item.awayScore}</span>
                    {typeof item.points === 'number' ? (
                      <span className={`w-14 text-right font-bold ${item.points > 0 ? 'text-brand' : 'text-zinc-500'}`}>{item.points} pts</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </article>
  )
}
