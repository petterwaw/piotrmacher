import { createServerSupabaseClient } from '@/app/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

type Rules = {
  correct_winner: number
  correct_difference: number
  correct_away_goals: number
  correct_home_goals: number
  exact_score: number
  exact_draw: number
}

function sanitizeRules(payload: unknown): Rules | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const source = payload as Record<string, unknown>
  const fields: Array<keyof Rules> = [
    'correct_winner',
    'correct_difference',
    'correct_away_goals',
    'correct_home_goals',
    'exact_score',
    'exact_draw',
  ]

  const nextRules = {} as Rules

  for (const field of fields) {
    const raw = source[field]
    const value = typeof raw === 'number' ? raw : Number(raw)

    if (!Number.isInteger(value) || value < 0 || value > 100) {
      return null
    }

    nextRules[field] = value
  }

  return nextRules
}

export async function PATCH(
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

    const { data: room } = await supabase
      .from('rooms')
      .select('id, host_id, status')
      .eq('id', room_id)
      .maybeSingle()

    if (!room) {
      return NextResponse.json({ error: 'Room not found.' }, { status: 404 })
    }

    if (room.host_id !== user.id) {
      return NextResponse.json({ error: 'Only host can change settings.' }, { status: 403 })
    }

    const body = await request.json().catch(() => null)
    const action = typeof body?.action === 'string' ? body.action : 'update'

    if (action === 'start') {
      if (room.status !== 'waiting') {
        return NextResponse.json({ error: 'Room is already started.' }, { status: 400 })
      }

      const { error: startError } = await supabase
        .from('rooms')
        .update({ status: 'active' })
        .eq('id', room_id)

      if (startError) {
        return NextResponse.json({ error: 'Could not start room.' }, { status: 500 })
      }

      return NextResponse.json({ ok: true })
    }

    if (room.status !== 'waiting') {
      return NextResponse.json(
        { error: 'Settings can only be changed while room is waiting.' },
        { status: 400 }
      )
    }

    const eventId = typeof body?.eventId === 'string' ? body.eventId : null
    const rules = sanitizeRules(body?.rules)

    if (!eventId || !rules) {
      return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 })
    }

    const { data: event } = await supabase
      .from('events')
      .select('id')
      .eq('id', eventId)
      .eq('is_active', true)
      .maybeSingle()

    if (!event) {
      return NextResponse.json({ error: 'Selected event is not active.' }, { status: 400 })
    }

    const { error: updateError } = await supabase
      .from('rooms')
      .update({
        event_id: eventId,
        rules,
      })
      .eq('id', room_id)

    if (updateError) {
      return NextResponse.json({ error: 'Could not update room settings.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}