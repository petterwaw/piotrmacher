'use client'

import type { PickemGroup } from '@/app/utils/pickem/groups'
import { Check, ChevronDown, ChevronUp, GripVertical, Lock, Save, Trophy } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useFlipReorder } from '@/app/components/motion/useLayoutMotion'

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
  const listRef = useRef<HTMLDivElement>(null)

  // Rows glide to their new place when the order changes (arrows or drag).
  // The trigger is the order itself, so refreshes never animate.
  useFlipReorder(listRef, JSON.stringify(orders))

  const teamsByGroup = useMemo(() => {
    return new Map(groups.map((group) => [
      group.groupKey,
      new Map(group.teams.map((team) => [team.teamId, team])),
    ]))
  }, [groups])

  // Client-side safety filter:
  // - always strip third-place groups
  // - deduplicate by groupKey
  // - when locked, only show groups the user has picks for
  const visibleGroups = useMemo(() => {
    const seen = new Set<string>()
    return groups.filter((group) => {
      const key = group.groupKey.toLowerCase()
      if (key.includes('3rd') || key.includes('third')) return false
      if (seen.has(group.groupKey)) return false
      seen.add(group.groupKey)
      if (!canEdit && !initialPicks[group.groupKey]) return false
      return true
    })
  }, [groups, canEdit, initialPicks])

  const hasUnsavedChanges = useMemo(() => {
    return visibleGroups.some((group) => {
      const current = orders[group.groupKey] ?? []
      const saved = initialPicks[group.groupKey]?.orderedTeamIds ?? group.teams.map((team) => team.teamId)
      return !sameOrder(current, saved)
    })
  }, [visibleGroups, initialPicks, orders])

  const totalPickemPoints = useMemo(() => {
    return Object.values(initialPicks).reduce((total, pick) => total + pick.points, 0)
  }, [initialPicks])

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
            groups: visibleGroups.map((group) => ({
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
    <div ref={listRef} className="stagger mx-auto max-w-2xl space-y-5">
      <div className="border-2 border-zinc-300 bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-brand">Pickem</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-text-main">Set the group order</h1>
            <p className="mt-2 max-w-[52ch] text-sm leading-relaxed text-zinc-700">
              Drag teams or use arrows. You get {pointsPerCorrectPosition} pts for every team placed in the correct final position.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <div className="border-2 border-zinc-300 bg-white px-3 py-2 text-xs font-bold uppercase tracking-wide text-zinc-600">
              <span className="block text-[11px] leading-none">Total points</span>
              <span className="mt-1.5 block text-lg font-black leading-none tabular-nums text-brand">{totalPickemPoints} pts</span>
            </div>
            <div className={`flex items-center gap-2 border-2 px-3 py-2 text-xs font-bold uppercase tracking-wide ${
              canEdit ? 'border-brand bg-brand text-white' : 'border-zinc-300 bg-zinc-100 text-text-muted'
            }`}>
              {canEdit ? <Trophy size={16} aria-hidden="true" /> : <Lock size={16} aria-hidden="true" />}
              {canEdit ? 'Open' : 'Locked'}
            </div>
          </div>
        </div>
      </div>

      {visibleGroups.map((group) => {
        const teamMap = teamsByGroup.get(group.groupKey) ?? new Map()
        const orderedTeams = (orders[group.groupKey] ?? [])
          .map((teamId) => teamMap.get(teamId))
          .filter((team): team is NonNullable<typeof team> => Boolean(team))
        const pick = initialPicks[group.groupKey]

        return (
          <section
            key={group.groupKey}
            className="border-2 border-zinc-300 bg-white/90 p-3 sm:p-4"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black tracking-tight text-text-main">{group.groupName}</h2>
                <p className="text-xs text-zinc-600">Your predicted final table</p>
              </div>
              {pick ? (
                <span className="shrink-0 border-2 border-zinc-300 bg-white px-3 py-1 text-sm font-black tabular-nums text-brand">
                  {pick.points} pts
                </span>
              ) : null}
            </div>

            <div className="space-y-2">
              {orderedTeams.map((team, index) => {
                const officialPosition = team.currentPosition

                return (
                  <div
                    key={team.teamId}
                    data-flip-key={`${group.groupKey}:${team.teamId}`}
                    draggable={canEdit && !isPending}
                    onDragStart={() => setDragged({ groupKey: group.groupKey, teamId: team.teamId })}
                    onDragOver={(event) => {
                      if (canEdit) event.preventDefault()
                    }}
                    onDrop={() => dropTeam(group.groupKey, team.teamId)}
                    onDragEnd={() => setDragged(null)}
                    className={`grid grid-cols-[1fr_auto] items-center gap-2 border-2 bg-white px-2 py-2 transition-[border-color,opacity] duration-150 sm:grid-cols-[20px_1fr_auto] sm:gap-3 sm:px-3 ${
                      dragged?.teamId === team.teamId ? 'border-dashed border-brand opacity-50' : 'border-zinc-200'
                    } ${canEdit ? 'cursor-grab hover:border-zinc-300 active:cursor-grabbing' : ''}`}
                  >
                    <div className="hidden items-center justify-center sm:flex">
                      <GripVertical size={16} aria-hidden="true" className={canEdit ? 'text-zinc-400' : 'text-zinc-200'} />
                    </div>

                    <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                      <span className="w-7 shrink-0 text-lg font-black tabular-nums text-brand">#{index + 1}</span>
                      {team.logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={team.logo} alt="" aria-hidden="true" className="h-8 w-8 shrink-0 object-contain" />
                      ) : (
                        <div aria-hidden="true" className="h-8 w-8 shrink-0 rounded-full bg-zinc-100" />
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-text-main">{team.name}</p>
                        <p className="text-xs tabular-nums text-zinc-600">
                          Current position: {officialPosition ? `#${officialPosition}` : 'unknown'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => moveTeam(group.groupKey, team.teamId, -1)}
                        disabled={!canEdit || isPending || index === 0}
                        className="touch-target inline-flex h-10 w-10 items-center justify-center border-2 border-zinc-300 bg-white text-text-main transition-colors hover:border-brand hover:text-brand active:bg-brand-tint disabled:opacity-30 disabled:hover:border-zinc-300 disabled:hover:text-text-main"
                        aria-label={`Move ${team.name} up`}
                      >
                        <ChevronUp size={18} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveTeam(group.groupKey, team.teamId, 1)}
                        disabled={!canEdit || isPending || index === orderedTeams.length - 1}
                        className="touch-target inline-flex h-10 w-10 items-center justify-center border-2 border-zinc-300 bg-white text-text-main transition-colors hover:border-brand hover:text-brand active:bg-brand-tint disabled:opacity-30 disabled:hover:border-zinc-300 disabled:hover:text-text-main"
                        aria-label={`Move ${team.name} down`}
                      >
                        <ChevronDown size={18} aria-hidden="true" />
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
          {error ? <p role="alert" className="animate-message-in text-sm font-medium text-danger">{error}</p> : null}
          {message ? (
            <p role="status" className="animate-message-in inline-flex items-center gap-1.5 text-sm font-medium text-brand">
              <Check size={16} strokeWidth={3} aria-hidden="true" className="animate-check-in" />
              {message}
            </p>
          ) : null}
        </div>

        {canEdit ? (
          <button
            type="button"
            className="btn-base btn-dark rounded-none gap-2"
            onClick={savePickem}
            disabled={isPending || !hasUnsavedChanges}
          >
            <Save size={16} aria-hidden="true" />
            {isPending ? 'Saving…' : 'Save Pickem'}
          </button>
        ) : null}
      </div>
    </div>
  )
}
