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
    events?: { logo?: string | null } | Array<{ logo?: string | null }> | null
    room_players?: Array<{ count: number }> | null
}

function capitalizeStatus(status: DatabaseRoom['status']): RoomCardProps['status'] {
    if (status === 'waiting') return 'Waiting'
    if (status === 'active') return 'Active'
    return 'Finished'
}

async function getRooms(): Promise<RoomCardProps[]> {
    try {
        const supabase = await createServerSupabaseClient()
        const {
            data: { user },
        } = await supabase.auth.getUser()

        const { data, error } = await supabase
            .from('rooms')
            .select('id, created_at, host_id, name, status, events(logo), room_players(count)')
            .order('created_at', { ascending: false })

        if (error || !data) {
            return typedRoomsData
        }

        const databaseRooms = data as DatabaseRoom[]

        if (databaseRooms.length === 0) {
            return []
        }

        const hostIds = [...new Set(databaseRooms.map((r) => r.host_id))]
        const { data: profiles } = await supabase
            .from('profiles')
            .select('id, username')
            .in('id', hostIds)
        const usernameById = new Map((profiles ?? []).map((p) => [p.id, p.username as string]))

        return databaseRooms.map((room) => ({
            eventLogo: Array.isArray(room.events)
                ? (room.events[0]?.logo ?? null)
                : (room.events?.logo ?? null),
            id: room.id,
            eventName: room.name,
            createdBy: usernameById.get(room.host_id) ?? room.host_id.slice(0, 8),
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
        <main className="mx-auto w-full max-w-[1320px] px-4 py-8 md:px-6">
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
                <RoomActions />

                {rooms.length > 0 ? rooms.map((room) => (
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
                )) : (
                    <div className="border-2 border-dashed border-zinc-300 bg-white/85 px-6 py-10 text-center text-text-muted sm:col-span-1 lg:col-span-3 xl:col-span-4">
                        No rooms yet. Create one or join using an invite code.
                    </div>
                )}
            </section>
        </main>
    )
}