import RoomNavigation from '@/app/components/RoomNavigation'
import { createServerSupabaseClient } from '@/app/utils/supabase/server'

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
    .select('host_id')
    .eq('id', room_id)
    .maybeSingle()

  const isHost = Boolean(user && room && room.host_id === user.id)

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <RoomNavigation roomId={room_id} showSettings={isHost} />

      {/* Page Content */}
      <div className="mt-6">{children}</div>
    </main>
  )
}
