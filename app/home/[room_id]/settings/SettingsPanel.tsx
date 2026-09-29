'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { Minus, Plus, X } from 'lucide-react'
import EventSelect from '@/app/components/EventSelect'
import DatePicker from '@/app/components/DatePicker'
import InviteShare from '@/app/components/InviteShare'

type Rules = {
  correct_winner: number
  correct_draw: number
  correct_difference: number
  correct_away_goals: number
  correct_home_goals: number
  exact_score: number
  exact_draw: number
  pickem_correct_position: number
}

type RuleKey = Exclude<keyof Rules, 'correct_away_goals' | 'correct_home_goals'> | 'team_goals'

const ruleLabels: Array<{ key: RuleKey; label: string; hint: string }> = [
  { key: 'correct_winner', label: 'Correct winner', hint: 'Picked the team that won' },
  { key: 'correct_draw', label: 'Correct draw', hint: 'Picked a draw, any score' },
  { key: 'correct_difference', label: 'Goal difference', hint: 'Same margin, like 2:0 for 3:1' },
  { key: 'team_goals', label: 'Team goals', hint: 'Per team, home and away separately' },
  { key: 'exact_score', label: 'Exact score', hint: 'Bonus on top, match with a winner' },
  { key: 'exact_draw', label: 'Exact draw', hint: 'Bonus on top, like 1:1 for 1:1' },
  { key: 'pickem_correct_position', label: 'Pickem position', hint: 'World Cup only, per team in its exact group spot' },
]

const SECTION = 'px-4 py-5 sm:px-6'
const H2 = 'text-base font-black tracking-tight text-text-main'
const HINT = 'mt-1 text-sm leading-snug text-zinc-600'
const STEP_BTN =
  'inline-flex h-11 w-11 items-center justify-center border-2 transition-colors disabled:opacity-40'

type Props = {
  roomId: string
  initialStatus: 'waiting' | 'active' | 'finished'
  initialEventId: string
  initialRoomEndAt: string | null
  inviteCode: string
  events: Array<{ id: string; name: string; season: string; displayName: string }>
  initialRules: Rules
}

export default function SettingsPanel({
  roomId,
  initialStatus,
  initialEventId,
  initialRoomEndAt,
  inviteCode,
  events,
  initialRules,
}: Props) {
  const router = useRouter()
  const [status, setStatus] = useState(initialStatus)
  const [eventId, setEventId] = useState(initialEventId)
  const [endMode, setEndMode] = useState<'full_event' | 'set_end_date'>(
    initialRoomEndAt ? 'set_end_date' : 'full_event'
  )
  const [roomEndAt, setRoomEndAt] = useState(() => {
    if (!initialRoomEndAt) return ''
    const date = new Date(initialRoomEndAt)
    if (Number.isNaN(date.getTime())) return ''
    const offsetMs = date.getTimezoneOffset() * 60 * 1000
    return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
  })
  const [rules, setRules] = useState<Rules>(initialRules)
  const [teamGoalsPoints, setTeamGoalsPoints] = useState(() =>
    Math.max(initialRules.correct_home_goals, initialRules.correct_away_goals)
  )
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [showStartConfirm, setShowStartConfirm] = useState(false)

  const isWaiting = status === 'waiting'

  const hasUnsavedChanges = useMemo(() => {
    const origEndMode: 'full_event' | 'set_end_date' = initialRoomEndAt ? 'set_end_date' : 'full_event'
    const origEndAt = (() => {
      if (!initialRoomEndAt) return ''
      const date = new Date(initialRoomEndAt)
      if (Number.isNaN(date.getTime())) return ''
      const offsetMs = date.getTimezoneOffset() * 60 * 1000
      return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
    })()
    if (eventId !== initialEventId) return true
    if (endMode !== origEndMode) return true
    if (endMode === 'set_end_date' && roomEndAt !== origEndAt) return true
    if (teamGoalsPoints !== Math.max(initialRules.correct_home_goals, initialRules.correct_away_goals)) return true
    const ruleKeys = ['correct_winner', 'correct_draw', 'correct_difference', 'exact_score', 'exact_draw', 'pickem_correct_position'] as const
    return ruleKeys.some((key) => rules[key] !== initialRules[key])
  }, [eventId, initialEventId, endMode, roomEndAt, initialRoomEndAt, rules, initialRules, teamGoalsPoints])

  const handleRuleChange = (key: RuleKey, value: string) => {
    const parsed = Number(value)
    const numValue = Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0
    if (key === 'team_goals') {
      setTeamGoalsPoints(numValue)
    } else {
      setRules((prev) => ({
        ...prev,
        [key]: numValue,
      }))
    }
  }

  const getRuleValue = (key: RuleKey) => {
    return key === 'team_goals' ? teamGoalsPoints : rules[key]
  }

  const saveSettings = () => {
    setError(null)
    setMessage(null)

    const normalizedRules: Rules = {
      ...rules,
      correct_home_goals: teamGoalsPoints,
      correct_away_goals: teamGoalsPoints,
    }

    startTransition(async () => {
      try {
        const response = await fetch(`/api/rooms/${roomId}/settings`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            eventId,
            rules: normalizedRules,
            roomEndAt: endMode === 'set_end_date' ? roomEndAt || null : null,
          }),
        })

        const data = (await response.json().catch(() => ({}))) as { error?: string }

        if (!response.ok) {
          throw new Error(data.error || 'Could not save settings.')
        }

        setMessage('Settings saved.')
        router.refresh()
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : 'Could not save settings.')
      }
    })
  }

  const startRoom = () => {
    setError(null)
    setMessage(null)

    startTransition(async () => {
      try {
        const response = await fetch(`/api/rooms/${roomId}/settings`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: 'start' }),
        })

        const data = (await response.json().catch(() => ({}))) as { error?: string }

        if (!response.ok) {
          throw new Error(data.error || 'Could not start room.')
        }

        setStatus('active')
        router.replace(`/home/${roomId}`)
        router.refresh()
      } catch (startError) {
        setError(startError instanceof Error ? startError.message : 'Could not start room.')
      }
    })
  }

  const saveAndStart = () => {
    setError(null)
    setMessage(null)

    const normalizedRules: Rules = {
      ...rules,
      correct_home_goals: teamGoalsPoints,
      correct_away_goals: teamGoalsPoints,
    }

    startTransition(async () => {
      try {
        const saveRes = await fetch(`/api/rooms/${roomId}/settings`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventId,
            rules: normalizedRules,
            roomEndAt: endMode === 'set_end_date' ? roomEndAt || null : null,
          }),
        })
        const saveData = (await saveRes.json().catch(() => ({}))) as { error?: string }
        if (!saveRes.ok) throw new Error(saveData.error || 'Could not save settings.')

        const startRes = await fetch(`/api/rooms/${roomId}/settings`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'start' }),
        })
        const startData = (await startRes.json().catch(() => ({}))) as { error?: string }
        if (!startRes.ok) throw new Error(startData.error || 'Could not start room.')

        setStatus('active')
        router.replace(`/home/${roomId}`)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not start room.')
      }
    })
  }

  const perfectPick =
    rules.correct_winner + rules.correct_difference + 2 * teamGoalsPoints + rules.exact_score
  const perfectDraw =
    rules.correct_draw + rules.correct_difference + 2 * teamGoalsPoints + rules.exact_draw

  return (
    <div className="mx-auto max-w-2xl">
      <div className="divide-y-2 divide-zinc-200 border-2 border-zinc-300 bg-white">
        <section className={SECTION} aria-labelledby="settings-invite">
          <h2 id="settings-invite" className={H2}>Invite friends</h2>
          <p className={`${HINT} mb-3`}>Send the link. Friends sign in and land straight in this room.</p>
          <InviteShare code={inviteCode} eventName={events.find((event) => event.id === eventId)?.name ?? null} />
        </section>

        <section className={SECTION} aria-labelledby="settings-event-title">
          <h2 id="settings-event-title" className={H2}>
            <label htmlFor="settings-event">Event</label>
          </h2>
          <p className={`${HINT} mb-3`}>The competition everyone bets on.</p>
          <EventSelect
            id="settings-event"
            value={eventId}
            onChange={setEventId}
            options={events}
            disabled={!isWaiting || isPending}
          />
        </section>

        <section className={SECTION} aria-labelledby="settings-duration">
          <h2 id="settings-duration" className={H2}>Room ends</h2>
          <p className={`${HINT} mb-3`}>Matches after the end date don&apos;t count.</p>
          <div className="flex" role="group" aria-labelledby="settings-duration">
            <button
              type="button"
              onClick={() => setEndMode('full_event')}
              disabled={!isWaiting || isPending}
              aria-pressed={endMode === 'full_event'}
              className={`min-h-11 flex-1 border-2 px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60 ${
                endMode === 'full_event'
                  ? 'border-brand bg-brand text-white'
                  : 'border-zinc-300 bg-white text-text-muted hover:border-brand hover:text-text-main'
              }`}
            >
              Full event
            </button>
            <button
              type="button"
              onClick={() => setEndMode('set_end_date')}
              disabled={!isWaiting || isPending}
              aria-pressed={endMode === 'set_end_date'}
              className={`min-h-11 flex-1 border-2 border-l-0 px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60 ${
                endMode === 'set_end_date'
                  ? 'border-brand bg-brand text-white'
                  : 'border-zinc-300 bg-white text-text-muted hover:border-brand hover:text-text-main'
              }`}
            >
              Set end date
            </button>
          </div>

          {endMode === 'set_end_date' ? (
            <div className="mt-3">
              <DatePicker
                value={roomEndAt}
                onChange={setRoomEndAt}
                disabled={!isWaiting || isPending}
                inline
              />
            </div>
          ) : null}
        </section>

        <section className={SECTION} aria-labelledby="settings-points">
          <h2 id="settings-points" className={H2}>Points</h2>
          <p className={HINT}>
            Rules stack, and matches are scored on the 90-minute result.{' '}
            <Link href={`/home/${roomId}/rules`} className="font-semibold text-brand underline hover:text-brand-hover">
              See examples
            </Link>
          </p>
          <ul className="mt-3 divide-y divide-zinc-200">
            {ruleLabels.map((rule) => {
              const value = getRuleValue(rule.key)
              const decreaseDisabled = !isWaiting || isPending || value <= 0
              const increaseDisabled = !isWaiting || isPending
              return (
                <li key={rule.key} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-[15px] font-bold text-text-main">{rule.label}</p>
                    <p className="text-sm leading-snug text-zinc-600">{rule.hint}</p>
                  </div>
                  <div className="flex shrink-0 items-center">
                    <button
                      type="button"
                      aria-label={`Decrease ${rule.label} points`}
                      className={`${STEP_BTN} border-zinc-300 bg-white text-text-main hover:border-zinc-500 active:bg-zinc-100 disabled:hover:border-zinc-300`}
                      onClick={() => handleRuleChange(rule.key, String(Math.max(0, value - 1)))}
                      disabled={decreaseDisabled}
                    >
                      <Minus size={16} strokeWidth={3} aria-hidden="true" />
                    </button>
                    <span aria-live="polite" className="w-10 text-center text-xl font-black tabular-nums text-text-main">{value}</span>
                    <button
                      type="button"
                      aria-label={`Increase ${rule.label} points`}
                      className={`${STEP_BTN} border-brand bg-brand text-white hover:border-brand-hover hover:bg-brand-hover active:bg-brand-hover disabled:hover:bg-brand`}
                      onClick={() => handleRuleChange(rule.key, String(value + 1))}
                      disabled={increaseDisabled}
                    >
                      <Plus size={16} strokeWidth={3} aria-hidden="true" />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
          <p className="mt-3 border-t-2 border-zinc-200 pt-3 text-sm text-zinc-700">
            A perfect pick is worth{' '}
            <strong className="font-bold tabular-nums text-text-main">{perfectPick} pts</strong>, an exact draw{' '}
            <strong className="font-bold tabular-nums text-text-main">{perfectDraw} pts</strong>.
          </p>
        </section>

        <section className={`${SECTION} bg-zinc-50`} aria-labelledby="settings-start">
          <h2 id="settings-start" className={H2}>Ready to play?</h2>
          <p className={HINT}>
            Starting opens betting. After that the event, end date and points can&apos;t be changed.
          </p>
          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
            <button
              type="button"
              className="btn-base btn-light rounded-none"
              onClick={saveSettings}
              disabled={!isWaiting || isPending}
            >
              Save changes
            </button>
            <button
              type="button"
              className="btn-base btn-dark rounded-none"
              onClick={() => {
                if (hasUnsavedChanges) {
                  setShowStartConfirm(true)
                } else {
                  startRoom()
                }
              }}
              disabled={!isWaiting || isPending}
            >
              Start room
            </button>
          </div>

          {!isWaiting ? (
            <p className="mt-3 text-sm text-text-muted">
              Room is already started. Event and rules are locked.
            </p>
          ) : null}

          {error ? <p role="alert" className="mt-3 text-sm font-medium text-danger">{error}</p> : null}
          {message ? <p role="status" className="mt-3 text-sm font-medium text-brand">{message}</p> : null}
        </section>
      </div>

      {showStartConfirm ? (
        <div className="animate-overlay-in fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
          <div role="dialog" aria-modal="true" aria-labelledby="start-confirm-title" className="animate-dialog-in w-full max-w-md border-2 border-zinc-300 bg-white p-5 shadow-xl shadow-black/20 sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 id="start-confirm-title" className="text-2xl font-black tracking-tight text-text-main">Unsaved changes</h2>
                <p className="mt-1 text-sm text-text-muted">
                  You have unsaved settings. What would you like to do before starting the room?
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowStartConfirm(false)}
                aria-label="Close"
                className="-mr-2 -mt-2 inline-flex h-11 w-11 shrink-0 items-center justify-center text-text-muted transition-colors hover:text-brand"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
              <button
                type="button"
                className="btn-base btn-light rounded-none"
                onClick={() => { setShowStartConfirm(false); startRoom() }}
                disabled={isPending}
              >
                Start without saving
              </button>
              <button
                type="button"
                className="btn-base btn-dark rounded-none"
                onClick={() => { setShowStartConfirm(false); saveAndStart() }}
                disabled={isPending}
              >
                Save and start
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
