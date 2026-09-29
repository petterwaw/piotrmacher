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

    // Membership rows can't be inserted directly (RLS); this SECURITY DEFINER
    // function validates the code and adds the caller to the room.
    const { data: roomId, error: joinError } = await supabase.rpc('join_room_by_code', { p_code: code })

    if (joinError || !roomId) {
      return NextResponse.json({ error: 'Room not found for this invite code.' }, { status: 404 })
    }

    return NextResponse.json({ roomId: roomId })
  } catch {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
