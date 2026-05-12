'use client'

import RoomFilters, { type RoomFiltersState, type RoomCardProps } from './RoomFilters'
import RoomCard from './RoomCard'
import RoomActions from './RoomActions'
import { useState, useEffect } from 'react'

export type { RoomCardProps }

export default function RoomsGrid({ rooms }: { rooms: RoomCardProps[] }) {
  const [filteredRooms, setFilteredRooms] = useState(rooms)
  const [filters, setFilters] = useState<RoomFiltersState>({ sort: 'newest', status: 'all' })

  useEffect(() => {
    setFilteredRooms(rooms)
  }, [rooms])

  const handleFiltersChange = (newFilters: RoomFiltersState, filtered: RoomCardProps[]) => {
    setFilters(newFilters)
    setFilteredRooms(filtered)
  }

  return (
    <>
      <RoomFilters rooms={rooms} onFiltersChange={handleFiltersChange} />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        <RoomActions />

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
