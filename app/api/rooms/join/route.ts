import { createServerSupabaseClient } from '@/app/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const code = typeof body?.code === 'string' ? body.code.trim().toLowerCase() : ''

    if (code.length < 4 || code.length > 32) {
      return NextResponse.json({ error: 'Enter a valid invite code.' }, { status: 400 })
    }

    // Direct SELECT on rooms is blocked by RLS for non-members.
    // SECURITY DEFINER function bypasses RLS to resolve invite_code → room id.
    const { data: roomId, error: roomError } = await supabase
      .rpc('get_room_id_by_invite_code', { p_code: code })

    if (roomError || !roomId) {
      return NextResponse.json({ error: 'Room not found for this invite code.' }, { status: 404 })
    }

    const { error: joinError } = await supabase.from('room_players').upsert(
      {
        room_id: roomId,
        user_id: user.id,
      },
      {
        onConflict: 'room_id,user_id',
        ignoreDuplicates: true,
      }
    )

    if (joinError) {
      return NextResponse.json({ error: 'Could not join room.' }, { status: 500 })
    }

    return NextResponse.json({ roomId: roomId })
  } catch {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
