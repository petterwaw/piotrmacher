import RoomNavigation from '@/app/components/RoomNavigation'

export default async function RoomLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ room_id: string }>
}) {
  const { room_id } = await params

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <RoomNavigation roomId={room_id} />

      {/* Page Content */}
      <div className="mt-6">{children}</div>
    </main>
  )
}
