'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { usePresence } from '@/app/components/motion/usePresence'

type SortOption = 'newest' | 'oldest'
type StatusFilter = 'all' | 'waiting' | 'active' | 'finished'

export type RoomFiltersState = {
  sort: SortOption
  status: StatusFilter
}

export type RoomCardProps = {
  id: string
  href: string
  eventName: string
  eventLogo?: string | null
  createdBy: string
  createdAt: string
  playersCount: number
  status: 'Waiting' | 'Active' | 'Finished'
}

interface RoomFiltersProps {
  sort: SortOption
  status: StatusFilter
  onSortChange: (sort: SortOption) => void
  onStatusChange: (status: StatusFilter) => void
  className?: string
}

export function applyFilters(rooms: RoomCardProps[], sort: SortOption, status: StatusFilter): RoomCardProps[] {
  let result = [...rooms]

  // Filter by status
  if (status !== 'all') {
    const statusLabel = status.charAt(0).toUpperCase() + status.slice(1)
    result = result.filter((room) => room.status === statusLabel)
  }

  // Sort
  result.sort((a, b) => {
    const timeA = new Date(a.createdAt).getTime()
    const timeB = new Date(b.createdAt).getTime()
    return sort === 'newest' ? timeB - timeA : timeA - timeB
  })

  return result
}

export default function RoomFilters({ sort, status, onSortChange, onStatusChange, className }: RoomFiltersProps) {
  const [sortOpen, setSortOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const statusRef = useRef<HTMLDivElement>(null)
  const sortRef = useRef<HTMLDivElement>(null)
  // Menus stay mounted for their exit animation.
  const sortMenu = usePresence(sortOpen)
  const statusMenu = usePresence(statusOpen)

  const statusMap: Record<StatusFilter, string> = {
    all: 'All Statuses',
    waiting: 'Waiting',
    active: 'Active',
    finished: 'Finished',
  }

  const sortMap: Record<SortOption, string> = {
    newest: 'Newest',
    oldest: 'Oldest',
  }

  // Close on a press outside the open filter or on Escape (focus returns to its toggle).
  useEffect(() => {
    if (!statusOpen && !sortOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (statusOpen && !statusRef.current?.contains(target)) setStatusOpen(false)
      if (sortOpen && !sortRef.current?.contains(target)) setSortOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      const openRef = statusOpen ? statusRef : sortRef
      setStatusOpen(false)
      setSortOpen(false)
      openRef.current?.querySelector<HTMLButtonElement>('button[aria-haspopup]')?.focus()
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [statusOpen, sortOpen])

  const handleStatusChange = (newStatus: StatusFilter) => {
    setStatusOpen(false)
    onStatusChange(newStatus)
  }

  const handleSortChange = (newSort: SortOption) => {
    setSortOpen(false)
    onSortChange(newSort)
  }

  return (
    <div className={className ?? 'mb-6 flex justify-end gap-2 sm:gap-3'}>
      {/* Status Filter */}
      <div ref={statusRef} className="relative">
        <button
          onClick={() => setStatusOpen(!statusOpen)}
          aria-expanded={statusOpen}
          aria-haspopup="listbox"
          className="flex min-h-10 items-center border-2 border-zinc-300 bg-white/80 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-text-main transition-colors hover:border-brand hover:bg-white aria-expanded:border-brand aria-expanded:bg-white"
        >
          {statusMap[status]}
          <ChevronDown size={14} aria-hidden="true" className={`ml-1.5 transition-transform duration-200 ${statusOpen ? 'rotate-180' : ''}`} />
        </button>

        {statusMenu.value && (
          <div role="listbox" className={`${statusMenu.isClosing ? 'animate-pop-out' : 'animate-pop-in'} absolute right-0 top-full z-30 mt-1 min-w-max border-2 border-zinc-300 bg-white shadow-lg shadow-black/10`}>
            {(Object.keys(statusMap) as StatusFilter[]).map((key) => (
              <button
                key={key}
                onClick={() => handleStatusChange(key)}
                role="option"
                aria-selected={status === key}
                className={`no-press flex min-h-11 w-full items-center px-4 py-2 text-left text-sm font-semibold uppercase tracking-wide transition-colors ${
                  status === key
                    ? 'bg-brand text-white'
                    : 'text-text-main hover:bg-brand-tint hover:text-brand'
                }`}
              >
                {statusMap[key]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Sort Filter */}
      <div ref={sortRef} className="relative">
        <button
          onClick={() => setSortOpen(!sortOpen)}
          aria-expanded={sortOpen}
          aria-haspopup="listbox"
          className="flex min-h-10 items-center border-2 border-zinc-300 bg-white/80 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-text-main transition-colors hover:border-brand hover:bg-white aria-expanded:border-brand aria-expanded:bg-white"
        >
          {sortMap[sort]}
          <ChevronDown size={14} aria-hidden="true" className={`ml-1.5 transition-transform duration-200 ${sortOpen ? 'rotate-180' : ''}`} />
        </button>

        {sortMenu.value && (
          <div role="listbox" className={`${sortMenu.isClosing ? 'animate-pop-out' : 'animate-pop-in'} absolute right-0 top-full z-30 mt-1 min-w-max border-2 border-zinc-300 bg-white shadow-lg shadow-black/10`}>
            {(Object.keys(sortMap) as SortOption[]).map((key) => (
              <button
                key={key}
                onClick={() => handleSortChange(key)}
                role="option"
                aria-selected={sort === key}
                className={`no-press flex min-h-11 w-full items-center px-4 py-2 text-left text-sm font-semibold uppercase tracking-wide transition-colors ${
                  sort === key
                    ? 'bg-brand text-white'
                    : 'text-text-main hover:bg-brand-tint hover:text-brand'
                }`}
              >
                {sortMap[key]}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
