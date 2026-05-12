import { createServerSupabaseClient } from '@/app/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
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

    // Check if user is in the room
    const { data: roomPlayer, error: checkError } = await supabase
      .from('room_players')
      .select('user_id')
      .eq('room_id', room_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (checkError || !roomPlayer) {
      return NextResponse.json({ error: 'You are not a member of this room.' }, { status: 404 })
    }

    // Delete all user's bets in this room
    await supabase.from('bets').delete().eq('room_id', room_id).eq('user_id', user.id)

    // Remove user from room
    const { error: leaveError } = await supabase
      .from('room_players')
      .delete()
      .eq('room_id', room_id)
      .eq('user_id', user.id)

    if (leaveError) {
      return NextResponse.json({ error: 'Could not leave room.' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
