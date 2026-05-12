import { createServerSupabaseClient } from '@/app/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ room_id: string }> }
) {
  try {
    const { room_id } = await params
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is the host
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('host_id, id')
      .eq('id', room_id)
      .maybeSingle()

    if (roomError || !room) {
      return NextResponse.json({ error: 'Room not found.' }, { status: 404 })
    }

    if (room.host_id !== user.id) {
      return NextResponse.json({ error: 'Only the host can delete the room.' }, { status: 403 })
    }

    // Delete all bets in the room
    await supabase.from('bets').delete().eq('room_id', room_id)

    // Delete all players in the room
    await supabase.from('room_players').delete().eq('room_id', room_id)

    // Delete the room
    const { error: deleteError } = await supabase.from('rooms').delete().eq('id', room_id)

    if (deleteError) {
      return NextResponse.json({ error: 'Could not delete room.' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
