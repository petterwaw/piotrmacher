import { createServerSupabaseClient } from '@/app/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

type BetPayload = {
  matchId?: string
  homeScore?: number
  awayScore?: number
}

const MAX_PREDICTED_GOALS = 20

function toNonNegativeInt(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > MAX_PREDICTED_GOALS) {
    return null
  }
  return parsed
}

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

    const body = (await request.json().catch(() => null)) as BetPayload | null
    const matchId = typeof body?.matchId === 'string' ? body.matchId : null
    const homeScore = toNonNegativeInt(body?.homeScore)
    const awayScore = toNonNegativeInt(body?.awayScore)

    if (!matchId || homeScore === null || awayScore === null) {
      return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 })
    }

    const { data: room } = await supabase
      .from('rooms')
      .select('id, event_id, status, created_at, room_end_at')
      .eq('id', room_id)
      .maybeSingle()

    if (!room) {
      return NextResponse.json({ error: 'Room not found.' }, { status: 404 })
    }

    if (room.status !== 'active') {
      return NextResponse.json({ error: 'Betting is available only in active rooms.' }, { status: 400 })
    }

    if (room.room_end_at && new Date(room.room_end_at).getTime() <= Date.now()) {
      return NextResponse.json({ error: 'Room is no longer active.' }, { status: 400 })
    }

    const { data: membership } = await supabase
      .from('room_players')
      .select('id')
      .eq('room_id', room_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!membership) {
      return NextResponse.json({ error: 'You are not a member of this room.' }, { status: 403 })
    }

    const { data: match } = await supabase
      .from('matches')
      .select('id, status, event_id, scheduled_start_at')
      .eq('id', matchId)
      .maybeSingle()

    if (!match || match.event_id !== room.event_id) {
      return NextResponse.json({ error: 'Match not found for this room event.' }, { status: 404 })
    }

    if (new Date(match.scheduled_start_at).getTime() < new Date(room.created_at).getTime()) {
      return NextResponse.json({ error: 'This match is outside the room timeline.' }, { status: 400 })
    }

    if (room.room_end_at && new Date(match.scheduled_start_at).getTime() > new Date(room.room_end_at).getTime()) {
      return NextResponse.json({ error: 'This match is outside the room timeline.' }, { status: 400 })
    }

    if (match.status === 'live' || match.status === 'finished' || match.status === 'cancelled') {
      return NextResponse.json({ error: 'Match started. Betting is locked.' }, { status: 400 })
    }

    const { data: existingBet } = await supabase
      .from('bets')
      .select('id')
      .eq('room_id', room_id)
      .eq('user_id', user.id)
      .eq('match_id', matchId)
      .maybeSingle()

    if (existingBet?.id) {
      const { error: updateError } = await supabase
        .from('bets')
        .update({
          home_score: homeScore,
          away_score: awayScore,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingBet.id)

      if (updateError) {
        return NextResponse.json({ error: 'Could not update bet.' }, { status: 500 })
      }

      return NextResponse.json({
        ok: true,
        bet: { matchId, homeScore, awayScore },
      })
    }

    const { error: insertError } = await supabase.from('bets').insert({
      room_id,
      user_id: user.id,
      match_id: matchId,
      home_score: homeScore,
      away_score: awayScore,
    })

    if (insertError) {
      return NextResponse.json({ error: 'Could not save bet.' }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      bet: { matchId, homeScore, awayScore },
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
