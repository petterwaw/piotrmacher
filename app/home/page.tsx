import RoomsGrid from '../components/RoomsGrid'
import { type RoomCardProps } from '../components/RoomFilters'
import roomsData from '../data/rooms.mock.json'
import { createServerSupabaseClient } from '../utils/supabase/server'

const typedRoomsData: RoomCardProps[] = (roomsData as Array<{
    id: string
    eventName: string
    eventLogo?: string | null
    createdBy: string
    createdAt: string
    playersCount: number
    status: RoomCardProps['status']
}>).map((room) => ({
    ...room,
    href: room.status === 'Active' ? `/home/${room.id}` : `/home/${room.id}/standings`,
}))

type DatabaseRoom = {
    id: string
    created_at: string
    host_id: string
    name: string
    status: 'waiting' | 'active' | 'finished'
    events?:
        | { logo?: string | null; name?: string | null; provider_event_id?: string | null }
        | Array<{ logo?: string | null; name?: string | null; provider_event_id?: string | null }>
        | null
    room_players?: Array<{ count: number }> | null
}

const WORLD_CUP_PROVIDER_EVENT_ID = '1'
const WORLD_CUP_FALLBACK_LOGO = '/worldcuplogo.svg'

function resolveEventLogo(event: DatabaseRoom['events']) {
    const row = Array.isArray(event) ? event[0] : event
    if (!row) return null

    const providerEventId = typeof row.provider_event_id === 'string' ? row.provider_event_id : null
    const eventName = typeof row.name === 'string' ? row.name : ''

    if (providerEventId === WORLD_CUP_PROVIDER_EVENT_ID || eventName === 'FIFA World Cup') {
        return WORLD_CUP_FALLBACK_LOGO
    }

    return row.logo ?? null
}

function capitalizeStatus(status: DatabaseRoom['status']): RoomCardProps['status'] {
    if (status === 'waiting') return 'Waiting'
    if (status === 'active') return 'Active'
    return 'Finished'
}

function resolveRoomHref(room: DatabaseRoom, currentUserId: string | null) {
    if (room.status === 'active') {
        return `/home/${room.id}`
    }

    if (room.status === 'waiting') {
        return currentUserId && room.host_id === currentUserId
            ? `/home/${room.id}/settings`
            : `/home/${room.id}/standings`
    }

    return `/home/${room.id}/standings`
}

async function getRooms(): Promise<RoomCardProps[]> {
    try {
        const supabase = await createServerSupabaseClient()
        const {
            data: { user },
        } = await supabase.auth.getUser()

        const { data, error } = await supabase
            .from('rooms')
            .select('id, created_at, host_id, name, status, events(logo,name,provider_event_id), room_players(count)')
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
            eventLogo: resolveEventLogo(room.events),
            href: resolveRoomHref(room, user?.id ?? null),
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
            <RoomsGrid rooms={rooms} />
        </main>
    )
}