'use client'

import type { PickemGroup } from '@/app/utils/pickem/groups'
import { ChevronDown, ChevronUp, GripVertical, Lock, Save, Trophy } from 'lucide-react'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

type PickemPick = {
  orderedTeamIds: string[]
  points: number
  scoredAt: string | null
}

type Props = {
  roomId: string
  groups: PickemGroup[]
  initialPicks: Record<string, PickemPick>
  canEdit: boolean
  pointsPerCorrectPosition: number
}

function buildInitialOrders(groups: PickemGroup[], picks: Record<string, PickemPick>) {
  const orders: Record<string, string[]> = {}

  for (const group of groups) {
    const officialTeamIds = group.teams.map((team) => team.teamId)
    const saved = picks[group.groupKey]?.orderedTeamIds ?? []
    const savedSet = new Set(saved)
    const hasValidSavedOrder =
      saved.length === officialTeamIds.length &&
      officialTeamIds.every((teamId) => savedSet.has(teamId))

    orders[group.groupKey] = hasValidSavedOrder ? saved : officialTeamIds
  }

  return orders
}

function sameOrder(a: string[], b: string[]) {
  return a.length === b.length && a.every((value, index) => value === b[index])
}

export default function PickemPanel({
  roomId,
  groups,
  initialPicks,
  canEdit,
  pointsPerCorrectPosition,
}: Props) {
  const router = useRouter()
  const [orders, setOrders] = useState(() => buildInitialOrders(groups, initialPicks))
  const [dragged, setDragged] = useState<{ groupKey: string; teamId: string } | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const teamsByGroup = useMemo(() => {
    return new Map(groups.map((group) => [
      group.groupKey,
      new Map(group.teams.map((team) => [team.teamId, team])),
    ]))
  }, [groups])

  const hasUnsavedChanges = useMemo(() => {
    return groups.some((group) => {
      const current = orders[group.groupKey] ?? []
      const saved = initialPicks[group.groupKey]?.orderedTeamIds ?? group.teams.map((team) => team.teamId)
      return !sameOrder(current, saved)
    })
  }, [groups, initialPicks, orders])

  useEffect(() => {
    if (!message) {
      return
    }

    const timeout = window.setTimeout(() => setMessage(null), 1800)
    return () => window.clearTimeout(timeout)
  }, [message])

  const moveTeam = (groupKey: string, teamId: string, direction: -1 | 1) => {
    if (!canEdit || isPending) return

    setOrders((prev) => {
      const next = [...(prev[groupKey] ?? [])]
      const currentIndex = next.indexOf(teamId)
      const targetIndex = currentIndex + direction

      if (currentIndex < 0 || targetIndex < 0 || targetIndex >= next.length) {
        return prev
      }

      const [item] = next.splice(currentIndex, 1)
      next.splice(targetIndex, 0, item)

      return { ...prev, [groupKey]: next }
    })
  }

  const dropTeam = (groupKey: string, targetTeamId: string) => {
    if (!canEdit || isPending || !dragged || dragged.groupKey !== groupKey) {
      setDragged(null)
      return
    }

    setOrders((prev) => {
      const next = [...(prev[groupKey] ?? [])]
      const fromIndex = next.indexOf(dragged.teamId)
      const toIndex = next.indexOf(targetTeamId)

      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
        return prev
      }

      const [item] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, item)

      return { ...prev, [groupKey]: next }
    })

    setDragged(null)
  }

  const savePickem = () => {
    setError(null)
    setMessage(null)

    startTransition(async () => {
      try {
        const response = await fetch(`/api/rooms/${roomId}/pickem`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            groups: groups.map((group) => ({
              groupKey: group.groupKey,
              orderedTeamIds: orders[group.groupKey] ?? [],
            })),
          }),
        })

        const data = (await response.json().catch(() => ({}))) as { error?: string }

        if (!response.ok) {
          throw new Error(data.error || 'Could not save Pickem.')
        }

        setMessage('Pickem saved.')
        router.refresh()
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : 'Could not save Pickem.')
      }
    })
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="border-2 border-zinc-300 bg-white p-5 transition-all duration-200 hover:border-brand hover:shadow-md">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-brand">Pickem</p>
            <h1 className="mt-1 text-2xl font-black text-text-main">Set the group order</h1>
            <p className="mt-2 text-sm text-text-muted">
              Drag teams or use arrows. You get {pointsPerCorrectPosition} pts for every team placed in the correct final position.
            </p>
          </div>
          <div className={`flex shrink-0 items-center gap-2 border-2 px-3 py-2 text-xs font-bold uppercase tracking-wide ${
            canEdit ? 'border-brand bg-brand text-white' : 'border-zinc-300 bg-zinc-100 text-text-muted'
          }`}>
            {canEdit ? <Trophy size={16} /> : <Lock size={16} />}
            {canEdit ? 'Open' : 'Locked'}
          </div>
        </div>
      </div>

      {groups.map((group) => {
        const teamMap = teamsByGroup.get(group.groupKey) ?? new Map()
        const orderedTeams = (orders[group.groupKey] ?? [])
          .map((teamId) => teamMap.get(teamId))
          .filter((team): team is NonNullable<typeof team> => Boolean(team))
        const pick = initialPicks[group.groupKey]

        return (
          <section
            key={group.groupKey}
            className="border-2 border-zinc-300 bg-white/90 p-4 transition-all duration-200 hover:border-brand hover:shadow-md"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-text-main">{group.groupName}</h2>
                <p className="text-xs text-text-muted">Your predicted final table</p>
              </div>
              {pick ? (
                <span className="border-2 border-zinc-300 bg-white px-3 py-1 text-sm font-black text-brand">
                  {pick.points} pts
                </span>
              ) : null}
            </div>

            <div className="space-y-2">
              {orderedTeams.map((team, index) => {
                const officialPosition = team.currentPosition
                const isCurrentMatch = officialPosition === index + 1

                return (
                  <div
                    key={team.teamId}
                    draggable={canEdit && !isPending}
                    onDragStart={() => setDragged({ groupKey: group.groupKey, teamId: team.teamId })}
                    onDragOver={(event) => {
                      if (canEdit) event.preventDefault()
                    }}
                    onDrop={() => dropTeam(group.groupKey, team.teamId)}
                    onDragEnd={() => setDragged(null)}
                    className={`grid grid-cols-[32px_1fr_auto] items-center gap-3 border-2 p-3 transition-all ${
                      isCurrentMatch
                        ? 'border-brand/70 bg-brand/5'
                        : 'border-zinc-200 bg-white'
                    } ${canEdit ? 'cursor-grab active:cursor-grabbing' : ''}`}
                  >
                    <div className="flex items-center gap-2">
                      <GripVertical size={16} className={canEdit ? 'text-zinc-400' : 'text-zinc-200'} />
                    </div>

                    <div className="flex min-w-0 items-center gap-3">
                      <span className="w-7 shrink-0 font-mono text-lg font-black text-brand">#{index + 1}</span>
                      {team.logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={team.logo} alt="" aria-hidden="true" className="h-8 w-8 shrink-0 object-contain" />
                      ) : (
                        <div className="h-8 w-8 shrink-0 bg-zinc-100" />
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-text-main">{team.name}</p>
                        <p className="text-xs text-text-muted">
                          Current position: {officialPosition ? `#${officialPosition}` : 'unknown'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveTeam(group.groupKey, team.teamId, -1)}
                        disabled={!canEdit || isPending || index === 0}
                        className="inline-flex h-8 w-8 items-center justify-center border-2 border-zinc-300 bg-white text-text-main transition-colors hover:border-brand hover:text-brand disabled:opacity-40"
                        aria-label={`Move ${team.name} up`}
                      >
                        <ChevronUp size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveTeam(group.groupKey, team.teamId, 1)}
                        disabled={!canEdit || isPending || index === orderedTeams.length - 1}
                        className="inline-flex h-8 w-8 items-center justify-center border-2 border-zinc-300 bg-white text-text-main transition-colors hover:border-brand hover:text-brand disabled:opacity-40"
                        aria-label={`Move ${team.name} down`}
                      >
                        <ChevronDown size={16} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          {error ? <p className="text-sm text-[#F97316]">{error}</p> : null}
          {message ? <p className="text-sm text-green-700">{message}</p> : null}
          {!canEdit ? (
            <p className="text-sm text-text-muted">Pickem is locked after the room starts.</p>
          ) : null}
        </div>

        <button
          type="button"
          className="btn-base btn-dark rounded-none gap-2"
          onClick={savePickem}
          disabled={!canEdit || isPending || !hasUnsavedChanges}
        >
          <Save size={16} />
          {isPending ? 'Saving...' : 'Save Pickem'}
        </button>
      </div>
    </div>
  )
}
