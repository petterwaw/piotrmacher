import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import RoomNavigation from '@/app/components/RoomNavigation'
import RoomStatusSync from '@/app/components/RoomStatusSync'
import { createServerSupabaseClient } from '@/app/utils/supabase/server'
import { isWorldCupPickemEvent } from '@/app/utils/pickem/eligibility'

type EventRelation =
  | { name: string | null; provider_event_id: string | null }
  | Array<{ name: string | null; provider_event_id: string | null }>
  | null

export default async function RoomLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ room_id: string }>
}) {
  const { room_id } = await params
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: room } = await supabase
    .from('rooms')
    .select('host_id, status, invite_code, events(name, provider_event_id)')
    .eq('id', room_id)
    .maybeSingle()

  const isHost = Boolean(user && room && room.host_id === user.id)
  const roomStatus = (room?.status as 'waiting' | 'active' | 'finished' | undefined) ?? 'waiting'
  const showSettings = isHost && roomStatus === 'waiting'

  const eventRelation = room?.events as EventRelation | undefined
  const eventRow = Array.isArray(eventRelation) ? eventRelation[0] : eventRelation
  const showPickem = isWorldCupPickemEvent(eventRow)
  // Finished rooms can't be joined, so there is nothing to share.
  const inviteCode = isHost && roomStatus !== 'finished' ? room?.invite_code ?? null : null

  return (
    <div className="mx-auto w-full max-w-[1320px] px-4 pt-1 pb-24 md:pt-6 md:px-6 md:pb-8">
      <RoomStatusSync roomId={room_id} initialStatus={roomStatus} />

      <div className="mb-3 md:hidden">
        <Link
          href="/home"
          prefetch
          aria-label="Back to rooms"
          className="press -ml-2 inline-flex h-11 w-11 items-center justify-center text-text-main transition-colors hover:text-brand"
        >
          <ArrowLeft size={24} aria-hidden="true" />
        </Link>
      </div>

      <div className="relative md:grid md:grid-cols-[minmax(120px,160px)_1fr] md:items-start md:gap-6 lg:mx-auto lg:max-w-[800px] lg:grid-cols-[176px_1fr] lg:gap-8 xl:mx-0 xl:block xl:max-w-none">
        <aside className="hidden md:block xl:absolute xl:left-0 xl:top-0 xl:w-44">
          <Link
            href="/home"
          prefetch
            aria-label="Back to rooms"
            title="Back to rooms"
            className="press mb-4 inline-flex h-12 w-12 items-center justify-center text-text-main transition-colors hover:text-brand"
          >
            <ArrowLeft size={28} aria-hidden="true" />
          </Link>

          <RoomNavigation roomId={room_id} roomStatus={roomStatus} showSettings={showSettings} showPickem={showPickem} isHost={isHost} inviteCode={inviteCode} eventName={eventRow?.name ?? null} />
        </aside>

        {/* Mobile bottom navigation is rendered by RoomNavigation itself. */}
        <div className="md:hidden">
          <RoomNavigation roomId={room_id} roomStatus={roomStatus} showSettings={showSettings} showPickem={showPickem} isHost={isHost} inviteCode={inviteCode} eventName={eventRow?.name ?? null} />
        </div>

        {/* Page Content */}
        <div className="mt-2 md:mt-0">
          <div className="mx-auto w-full max-w-xl md:max-w-none xl:mx-auto xl:max-w-xl">{children}</div>
        </div>
      </div>
    </div>
  )
}
