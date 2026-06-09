'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { X } from 'lucide-react'
import EventSelect from '@/app/components/EventSelect'
import DatePicker from '@/app/components/DatePicker'

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

const ruleLabels: Array<{ key: Exclude<keyof Rules, 'correct_away_goals' | 'correct_home_goals'> | 'team_goals'; label: string }> = [
  { key: 'correct_winner', label: 'Correct winner' },
  { key: 'correct_draw', label: 'Correct draw' },
  { key: 'correct_difference', label: 'Correct difference' },
  { key: 'team_goals', label: 'Correct team goals' },
  { key: 'exact_score', label: 'Exact score' },
  { key: 'exact_draw', label: 'Exact draw' },
  { key: 'pickem_correct_position', label: 'Pickem correct position' },
]

const ruleDescriptions: Record<Exclude<keyof Rules, 'correct_away_goals' | 'correct_home_goals'> | 'team_goals', { explain: string; example: string }> = {
  correct_winner: {
    explain: 'Awarded when predicted non-draw outcome matches final outcome (home win or away win).',
    example: 'Example: 2:1 vs 4:2 -> home win in both, so winner points are awarded.',
  },
  correct_draw: {
    explain: 'Awarded when both predicted and final outcomes are a draw.',
    example: 'Example: 0:0 vs 2:2 -> both are draws, so draw points are awarded.',
  },
  correct_difference: {
    explain: 'Awarded when predicted goal difference equals final goal difference.',
    example: 'Example: 3:1 vs 2:0 -> difference is +2 in both scores.',
  },
  team_goals: {
    explain: 'Awarded for each team where exact goals were predicted. Same points value applies to home and away team goals.',
    example: 'Example: 2:1 vs 2:3 -> home goals match, away goals do not.',
  },
  exact_score: {
    explain: 'Awarded when both goals are predicted exactly for a non-draw final score.',
    example: 'Example: 2:1 vs 2:1 -> exact score points are awarded.',
  },
  exact_draw: {
    explain: 'Awarded when exact draw score is predicted.',
    example: 'Example: 1:1 vs 1:1 -> exact draw points are awarded.',
  },
  pickem_correct_position: {
    explain: 'Awarded for each team placed in the exact final group position in Pickem.',
    example: 'Example: Brazil predicted #1 and finishes #1 -> Pickem position points are awarded.',
  },
}

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
  const [copied, setCopied] = useState(false)
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

  const handleRuleChange = (key: typeof ruleLabels[0]['key'], value: string) => {
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

  const getRuleValue = (key: typeof ruleLabels[0]['key']) => {
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

  const copyInviteCode = async () => {
    try {
      await navigator.clipboard.writeText(inviteCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      setError('Could not copy invite code.')
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="border-2 border-zinc-300 bg-white p-5 transition-all duration-200 hover:border-brand hover:shadow-md">
        <p className="text-sm font-medium text-text-main">Invite code</p>
        <div className="mt-2 flex items-center gap-3">
          <span className="bg-white px-3 py-2 font-mono text-sm text-text-main border-2 border-zinc-300">
            {inviteCode}
          </span>
          <button type="button" className="btn-base btn-light rounded-none" onClick={copyInviteCode}>
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      <div className="border-2 border-zinc-300 bg-white p-5 transition-all duration-200 hover:border-brand hover:shadow-md">
        <label className="mb-2 block text-sm font-medium text-text-main" htmlFor="settings-event">
          Event
        </label>
        <EventSelect
          id="settings-event"
          value={eventId}
          onChange={setEventId}
          options={events}
          disabled={!isWaiting || isPending}
        />
      </div>

      <div className="border-2 border-zinc-300 bg-white p-5 transition-all duration-200 hover:border-brand hover:shadow-md space-y-3">
        <p className="text-sm font-medium text-text-main">Room duration</p>
        <div className="flex">
          <button
            type="button"
            onClick={() => setEndMode('full_event')}
            disabled={!isWaiting || isPending}
            className={`flex-1 border-2 px-4 py-2 text-sm font-semibold transition-colors ${
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
            className={`flex-1 border-2 border-l-0 px-4 py-2 text-sm font-semibold transition-colors ${
              endMode === 'set_end_date'
                ? 'border-brand bg-brand text-white'
                : 'border-zinc-300 bg-white text-text-muted hover:border-brand hover:text-text-main'
            }`}
          >
            Set end date
          </button>
        </div>

        {endMode === 'set_end_date' ? (
          <DatePicker
            value={roomEndAt}
            onChange={setRoomEndAt}
            disabled={!isWaiting || isPending}
            inline
          />
        ) : null}
      </div>

      <div className="border-2 border-zinc-300 bg-white p-5 transition-all duration-200 hover:border-brand hover:shadow-md">
        <p className="mb-4 text-sm font-medium text-text-main">Scoring rules</p>
        <div className="mb-4 border border-zinc-200 bg-zinc-50 p-3 text-sm text-text-main">
          <p className="font-semibold">Cup matches are settled after 90 minutes only.</p>
          <p className="mt-1 text-text-muted">Extra time and penalties are not supported in room scoring yet.</p>
        </div>
        <div className="space-y-3">
          {ruleLabels.map((rule) => {
            const value = getRuleValue(rule.key)
            const decreaseDisabled = !isWaiting || isPending || value <= 0
            const increaseDisabled = !isWaiting || isPending
            return (
              <div key={rule.key} className="border-b border-border-soft pb-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-text-main">{rule.label}</p>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="h-8 w-8 border-2 border-zinc-300 bg-white text-base font-bold leading-none text-text-main transition-colors hover:border-zinc-400 disabled:opacity-60"
                      onClick={() => handleRuleChange(rule.key, String(Math.max(0, value - 1)))}
                      disabled={decreaseDisabled}
                    >
                      −
                    </button>
                    <span className="w-12 text-center font-mono text-lg font-bold text-text-main">{value}</span>
                    <button
                      type="button"
                      className="h-8 w-8 border-2 border-brand bg-brand text-base font-bold leading-none text-white transition-colors hover:border-brand-soft hover:bg-brand-soft disabled:opacity-60"
                      onClick={() => handleRuleChange(rule.key, String(value + 1))}
                      disabled={increaseDisabled}
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="mt-2 space-y-1 text-xs text-zinc-500">
                  <p>{ruleDescriptions[rule.key].explain}</p>
                  <p>{ruleDescriptions[rule.key].example}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-3">
        <button
          type="button"
          className="btn-base btn-light rounded-none"
          onClick={saveSettings}
          disabled={!isWaiting || isPending}
        >
          Save settings
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
        <p className="text-sm text-text-muted">
          Room is already started. Event and rules are locked.
        </p>
      ) : null}

      {error ? <p className="text-sm text-[#F97316]">{error}</p> : null}
      {message ? <p className="text-sm text-green-700">{message}</p> : null}

      {showStartConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6">
          <div className="w-full max-w-md border-2 border-zinc-300 bg-white p-6 shadow-md">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-text-main">Unsaved changes</h2>
                <p className="mt-1 text-sm text-text-muted">
                  You have unsaved settings. What would you like to do before starting the room?
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowStartConfirm(false)}
                className="inline-flex h-9 w-9 items-center justify-center text-text-muted transition-colors hover:text-brand"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex justify-end gap-3">
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
