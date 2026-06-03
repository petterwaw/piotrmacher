import { createServerSupabaseClient } from '@/app/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const defaultRules = {
  correct_winner: 1,
  correct_draw: 1,
  correct_difference: 1,
  correct_away_goals: 1,
  correct_home_goals: 1,
  exact_score: 1,
  exact_draw: 1,
}

function parseOptionalDate(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) {
    return null
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed.toISOString()
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
    const eventIdFromBody = typeof body?.eventId === 'string' ? body.eventId : null
    const roomEndAt = parseOptionalDate(body?.roomEndAt)

    if (name.length < 3 || name.length > 60) {
      return NextResponse.json(
        { error: 'Room name must be between 3 and 60 characters.' },
        { status: 400 }
      )
    }

    let eventId = eventIdFromBody

    if (eventId) {
      const { data: selectedEvent } = await supabase
        .from('events')
        .select('id')
        .eq('id', eventId)
        .eq('is_active', true)
        .maybeSingle()

      if (!selectedEvent) {
        return NextResponse.json({ error: 'Selected event is not active.' }, { status: 400 })
      }
    }

    if (!eventId) {
      const { data: fallbackEvent } = await supabase
        .from('events')
        .select('id')
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      eventId = fallbackEvent?.id ?? null
    }

    if (typeof body?.roomEndAt === 'string' && !roomEndAt) {
      return NextResponse.json({ error: 'Invalid room end date.' }, { status: 400 })
    }

    if (roomEndAt && new Date(roomEndAt).getTime() <= Date.now()) {
      return NextResponse.json({ error: 'Room end date must be in the future.' }, { status: 400 })
    }

    if (!eventId) {
      return NextResponse.json(
        { error: 'No active event configured. Create an event first.' },
        { status: 400 }
      )
    }

    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .insert({
        name,
        host_id: user.id,
        event_id: eventId,
        rules: defaultRules,
        room_end_at: roomEndAt,
      })
      .select('id')
      .single()

    if (roomError || !room) {
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
      return NextResponse.json({ error: 'Room created, but membership could not be added.' }, { status: 500 })
    }

    return NextResponse.json({ roomId: room.id }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
