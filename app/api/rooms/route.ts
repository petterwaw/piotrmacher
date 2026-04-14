import { createServerSupabaseClient } from '@/app/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const defaultRules = {
  correct_winner: 1,
  correct_difference: 1,
  correct_away_goals: 1,
  correct_home_goals: 1,
  exact_score: 1,
  exact_draw: 1,
}

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
    const name = typeof body?.name === 'string' ? body.name.trim() : ''

    if (name.length < 3 || name.length > 60) {
      return NextResponse.json(
        { error: 'Room name must be between 3 and 60 characters.' },
        { status: 400 }
      )
    }

    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .insert({
        name,
        host_id: user.id,
        rules: defaultRules,
      })
      .select('id')
      .single()

    if (roomError || !room) {
      console.error('Create room error:', roomError)
      return NextResponse.json({ error: 'Could not create room.' }, { status: 500 })
    }

    const { error: memberError } = await supabase.from('room_players').upsert(
      {
        room_id: room.id,
        user_id: user.id,
      },
      {
        onConflict: 'room_id,user_id',
        ignoreDuplicates: true,
      }
    )

    if (memberError) {
      console.error('Create room membership error:', memberError)
    }

    return NextResponse.json({ roomId: room.id }, { status: 201 })
  } catch (error) {
    console.error('Create room route error:', error)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
