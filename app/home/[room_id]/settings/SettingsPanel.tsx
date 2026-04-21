'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'

type Rules = {
  correct_winner: number
  correct_difference: number
  correct_away_goals: number
  correct_home_goals: number
  exact_score: number
  exact_draw: number
}

const ruleLabels: Array<{ key: keyof Rules; label: string }> = [
  { key: 'correct_winner', label: 'Correct winner' },
  { key: 'correct_difference', label: 'Correct difference' },
  { key: 'correct_away_goals', label: 'Correct away goals' },
  { key: 'correct_home_goals', label: 'Correct home goals' },
  { key: 'exact_score', label: 'Exact score' },
  { key: 'exact_draw', label: 'Exact draw' },
]

type Props = {
  roomId: string
  initialStatus: 'waiting' | 'active' | 'finished'
  initialEventId: string
  inviteCode: string
  events: Array<{ id: string; name: string; season: string; displayName: string }>
  initialRules: Rules
}

export default function SettingsPanel({
  roomId,
  initialStatus,
  initialEventId,
  inviteCode,
  events,
  initialRules,
}: Props) {
  const router = useRouter()
  const [status, setStatus] = useState(initialStatus)
  const [eventId, setEventId] = useState(initialEventId)
  const [rules, setRules] = useState<Rules>(initialRules)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isPending, startTransition] = useTransition()

  const isWaiting = status === 'waiting'

  const statusBadgeClass = useMemo(() => {
    if (status === 'active') return 'bg-green-100 text-green-800'
    if (status === 'finished') return 'bg-gray-100 text-gray-700'
    return 'bg-yellow-100 text-yellow-800'
  }, [status])

  const handleRuleChange = (key: keyof Rules, value: string) => {
    const parsed = Number(value)
    setRules((prev) => ({
      ...prev,
      [key]: Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0,
    }))
  }

  const saveSettings = () => {
    setError(null)
    setMessage(null)

    startTransition(async () => {
      try {
        const response = await fetch(`/api/rooms/${roomId}/settings`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ eventId, rules }),
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
        setMessage('Room started. Betting is now enabled.')
        router.refresh()
      } catch (startError) {
        setError(startError instanceof Error ? startError.message : 'Could not start room.')
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
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-text-main">Settings</h2>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass}`}>
          {status}
        </span>
      </div>

      <div className="rounded-xl border border-border-soft bg-white p-5 shadow-sm space-y-4">
        <div className="rounded-xl border border-border-soft bg-bg-page p-4">
          <p className="text-sm font-medium text-text-main">Invite code</p>
          <div className="mt-2 flex items-center gap-3">
            <span className="rounded-md bg-white px-3 py-2 font-mono text-sm text-text-main border border-border-soft">
              {inviteCode}
            </span>
            <button type="button" className="btn-base btn-light" onClick={copyInviteCode}>
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-text-main" htmlFor="settings-event">
            Event
          </label>
          <select
            id="settings-event"
            value={eventId}
            onChange={(event) => setEventId(event.target.value)}
            disabled={!isWaiting || isPending}
            className="w-full rounded-xl border border-border-soft bg-white px-4 py-3 text-text-main outline-none transition-colors focus:border-brand disabled:bg-gray-100"
          >
            {events.map((eventOption) => (
              <option key={eventOption.id} value={eventOption.id}>
                {eventOption.displayName}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {ruleLabels.map((rule) => (
            <label key={rule.key} className="text-sm text-text-main">
              <span className="mb-1 block font-medium">{rule.label}</span>
              <input
                type="number"
                min={0}
                value={rules[rule.key]}
                onChange={(event) => handleRuleChange(rule.key, event.target.value)}
                disabled={!isWaiting || isPending}
                className="w-full rounded-xl border border-border-soft bg-white px-3 py-2 outline-none transition-colors focus:border-brand disabled:bg-gray-100"
              />
            </label>
          ))}
        </div>

        <div className="flex flex-wrap justify-end gap-3">
          <button
            type="button"
            className="btn-base btn-light"
            onClick={saveSettings}
            disabled={!isWaiting || isPending}
          >
            Save settings
          </button>
          <button
            type="button"
            className="btn-base btn-dark"
            onClick={startRoom}
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

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {message ? <p className="text-sm text-green-700">{message}</p> : null}
      </div>
    </div>
  )
}
