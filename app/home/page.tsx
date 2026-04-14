import RoomActions from '../components/RoomActions'
import RoomCard, { type RoomCardProps } from '../components/RoomCard'
import roomsData from '../data/rooms.mock.json'
import { createServerSupabaseClient } from '../utils/supabase/server'

const typedRoomsData = roomsData as RoomCardProps[]

type DatabaseRoom = {
    id: string
    created_at: string
    host_id: string
    name: string
    status: 'waiting' | 'active' | 'finished'
    room_players?: Array<{ count: number }> | null
}

function capitalizeStatus(status: DatabaseRoom['status']): RoomCardProps['status'] {
    return status.charAt(0).toUpperCase() as RoomCardProps['status']
}

async function getRooms(): Promise<RoomCardProps[]> {
    try {
        const supabase = await createServerSupabaseClient()
        const {
            data: { user },
        } = await supabase.auth.getUser()

        const { data, error } = await supabase
            .from('rooms')
            .select('id, created_at, host_id, name, status, room_players(count)')
            .order('created_at', { ascending: false })

        if (error || !data) {
            return typedRoomsData
        }

        const databaseRooms = data as DatabaseRoom[]

        if (databaseRooms.length === 0) {
            return []
        }

        return databaseRooms.map((room) => ({
            id: room.id,
            eventName: room.name,
            createdBy: room.host_id === user?.id ? 'You' : 'Host',
            createdAt: room.created_at,
            playersCount: room.room_players?.[0]?.count ?? 0,
            status: capitalizeStatus(room.status),
        }))
    } catch {
        return typedRoomsData
    }
}

export default async function HomePage() {
    const rooms = await getRooms()

    return (
        <main className="max-w-6xl mx-auto px-4 py-8">
            <h1 className="text-2xl font-bold text-text-main mb-6">Available rooms</h1>
            <RoomActions />
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {rooms.length > 0 ? rooms.map((room) => (
                <RoomCard
                    key={room.id}
                    id={room.id}
                    eventName={room.eventName}
                    createdBy={room.createdBy}
                    createdAt={room.createdAt}
                    playersCount={room.playersCount}
                    status={room.status}
                />
            )) : (
                <div className="rounded-2xl border border-dashed border-border-soft bg-white px-6 py-10 text-center text-text-muted sm:col-span-2 lg:col-span-3">
                    No rooms yet. Create one or join using an invite code.
                </div>
            )}
            </section>
        </main>
    )
}