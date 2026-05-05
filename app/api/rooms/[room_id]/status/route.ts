import { createServerSupabaseClient } from '@/app/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  _request: Request,
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

    const [{ data: room }, { data: membership }] = await Promise.all([
      supabase.from('rooms').select('status, host_id').eq('id', room_id).maybeSingle(),
      supabase
        .from('room_players')
        .select('id')
        .eq('room_id', room_id)
        .eq('user_id', user.id)
        .maybeSingle(),
    ])

    if (!room) {
      return NextResponse.json({ error: 'Room not found.' }, { status: 404 })
    }

    if (!membership && room.host_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ status: room.status })
  } catch {
    return NextResponse.json({ error: 'Could not load room status.' }, { status: 500 })
  }
}