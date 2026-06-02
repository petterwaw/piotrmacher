'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

type SortOption = 'newest' | 'oldest'
type StatusFilter = 'all' | 'waiting' | 'active' | 'finished'

export type RoomFiltersState = {
  sort: SortOption
  status: StatusFilter
}

export type RoomCardProps = {
  id: string
  eventName: string
  eventLogo?: string | null
  createdBy: string
  createdAt: string
  playersCount: number
  status: 'Waiting' | 'Active' | 'Finished'
}

interface RoomFiltersProps {
  rooms: RoomCardProps[]
  onFiltersChange: (filters: RoomFiltersState, filtered: RoomCardProps[]) => void
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

export default function RoomFilters({ rooms, onFiltersChange, sort, status, onSortChange, onStatusChange, className }: RoomFiltersProps) {
  const [sortOpen, setSortOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)

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
      <div className="relative">
        <button
          onClick={() => setStatusOpen(!statusOpen)}
          className="flex items-center border-2 border-zinc-300 bg-white/80 px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-text-main transition-all hover:bg-zinc-100"
        >
          {statusMap[status]}
          <ChevronDown size={14} className={`ml-1.5 transition-transform ${statusOpen ? 'rotate-180' : ''}`} />
        </button>

        {statusOpen && (
          <div className="absolute left-0 top-full z-30 mt-1 min-w-max border-2 border-zinc-300 bg-white">
            {(Object.keys(statusMap) as StatusFilter[]).map((key) => (
              <button
                key={key}
                onClick={() => handleStatusChange(key)}
                className={`block w-full px-4 py-2 text-left text-sm font-semibold uppercase tracking-wide transition-colors ${
                  status === key
                    ? 'bg-brand text-white'
                    : 'text-text-muted hover:bg-zinc-100'
                }`}
              >
                {statusMap[key]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Sort Filter */}
      <div className="relative">
        <button
          onClick={() => setSortOpen(!sortOpen)}
          className="flex items-center border-2 border-zinc-300 bg-white/80 px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-text-main transition-all hover:bg-zinc-100"
        >
          {sortMap[sort]}
          <ChevronDown size={14} className={`ml-1.5 transition-transform ${sortOpen ? 'rotate-180' : ''}`} />
        </button>

        {sortOpen && (
          <div className="absolute left-0 top-full z-30 mt-1 min-w-max border-2 border-zinc-300 bg-white">
            {(Object.keys(sortMap) as SortOption[]).map((key) => (
              <button
                key={key}
                onClick={() => handleSortChange(key)}
                className={`block w-full px-4 py-2 text-left text-sm font-semibold uppercase tracking-wide transition-colors ${
                  sort === key
                    ? 'bg-brand text-white'
                    : 'text-text-muted hover:bg-zinc-100'
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
