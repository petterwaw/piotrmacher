'use client'

import RoomFilters, { type RoomFiltersState, type RoomCardProps, applyFilters } from './RoomFilters'
import RoomCard from './RoomCard'
import RoomActions from './RoomActions'
import { useState, useEffect } from 'react'

export type { RoomCardProps }

export default function RoomsGrid({ rooms }: { rooms: RoomCardProps[] }) {
  const [sort, setSort] = useState<RoomFiltersState['sort']>('newest')
  const [status, setStatus] = useState<RoomFiltersState['status']>('all')
  const [filteredRooms, setFilteredRooms] = useState(rooms)

  useEffect(() => {
    setFilteredRooms(applyFilters(rooms, sort, status))
  }, [rooms, sort, status])

  const filterProps = {
    rooms,
    onFiltersChange: () => {},
    sort,
    status,
    onSortChange: setSort,
    onStatusChange: setStatus,
  }

  return (
    <>
      {/* Desktop: filters above grid */}
      <RoomFilters {...filterProps} className="mb-6 hidden sm:flex justify-end gap-2 sm:gap-3" />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        <RoomActions />

        {/* Mobile: filters below Create/Join buttons */}
        <div className="col-span-full sm:hidden">
          <RoomFilters {...filterProps} className="flex justify-end gap-2" />
        </div>

        {filteredRooms.map((room) => (
          <RoomCard
            key={room.id}
            id={room.id}
            eventName={room.eventName}
            eventLogo={room.eventLogo}
            createdBy={room.createdBy}
            createdAt={room.createdAt}
            playersCount={room.playersCount}
            status={room.status}
          />
        ))}
      </section>
    </>
  )
}
