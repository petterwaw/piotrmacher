import { createServiceRoleSupabaseClient } from '@/app/utils/supabase/service'
import { NextRequest, NextResponse } from 'next/server'

type Rules = {
  correct_winner?: number
  correct_difference?: number
  correct_away_goals?: number
  correct_home_goals?: number
  exact_score?: number
  exact_draw?: number
}

type BetWithRelations = {
  id: string
  room_id: string
  user_id: string
  match_id: string
  home_score: number
  away_score: number
  points: number | null
  rooms:
    | { rules: Rules; created_at: string; room_end_at: string | null }
    | Array<{ rules: Rules; created_at: string; room_end_at: string | null }>
    | null
  matches:
    | {
        status: string
        scheduled_start_at: string
        home_score_ft: number | null
        away_score_ft: number | null
      }
    | Array<{
        status: string
        scheduled_start_at: string
        home_score_ft: number | null
        away_score_ft: number | null
      }>
    | null
}

async function backfillMissingScoringJobs(supabase: ReturnType<typeof createServiceRoleSupabaseClient>) {
  const { data: unscoredBets, error: unscoredBetsError } = await supabase
    .from('bets')
    .select('match_id')
    .is('points', null)

  if (unscoredBetsError || !unscoredBets || unscoredBets.length === 0) {
    return
  }

  const candidateMatchIds = [...new Set(unscoredBets.map((row) => row.match_id))]
  if (candidateMatchIds.length === 0) {
    return
  }

  const { data: finishedMatches, error: finishedMatchesError } = await supabase
    .from('matches')
    .select('id')
    .in('id', candidateMatchIds)
    .eq('status', 'finished')

  if (finishedMatchesError || !finishedMatches || finishedMatches.length === 0) {
    return
  }

  const finishedMatchIds = finishedMatches.map((row) => row.id)
  const { data: existingJobs } = await supabase
    .from('scoring_jobs')
    .select('match_id')
    .in('match_id', finishedMatchIds)

  const existingMatchIds = new Set((existingJobs ?? []).map((row) => row.match_id))
  const missingRows = finishedMatchIds
    .filter((matchId) => !existingMatchIds.has(matchId))
    .map((matchId) => ({ match_id: matchId }))

  if (missingRows.length > 0) {
    await supabase.from('scoring_jobs').upsert(missingRows, { onConflict: 'match_id' })
  }
}

function pickOne<T>(value: T | T[] | null): T | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

function matchOutcome(home: number, away: number): 'home' | 'away' | 'draw' {
  if (home > away) return 'home'
  if (away > home) return 'away'
  return 'draw'
}

function toRuleScore(rules: Rules, key: keyof Rules): number {
  const value = rules[key]
  return Number.isFinite(value) ? Number(value) : 0
}

function calculatePoints(
  predictedHome: number,
  predictedAway: number,
  actualHome: number,
  actualAway: number,
  rules: Rules
): number {
  let points = 0

  const predictedOutcome = matchOutcome(predictedHome, predictedAway)
  const actualOutcome = matchOutcome(actualHome, actualAway)

  if (predictedOutcome === actualOutcome) {
    points += toRuleScore(rules, 'correct_winner')
  }

  if (predictedHome - predictedAway === actualHome - actualAway) {
    points += toRuleScore(rules, 'correct_difference')
  }

  if (predictedHome === actualHome) {
    points += toRuleScore(rules, 'correct_home_goals')
  }

  if (predictedAway === actualAway) {
    points += toRuleScore(rules, 'correct_away_goals')
  }

  const isExact = predictedHome === actualHome && predictedAway === actualAway
  if (isExact && actualOutcome === 'draw') {
    points += toRuleScore(rules, 'exact_draw')
  } else if (isExact) {
    points += toRuleScore(rules, 'exact_score')
  }

  return points
}

async function processScoringJobs(request: NextRequest) {
  const auth = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const batchSizeRaw = request.nextUrl.searchParams.get('batch')
  const batchSize = Math.min(200, Math.max(1, Number(batchSizeRaw || '50')))

  const supabase = createServiceRoleSupabaseClient()

  await backfillMissingScoringJobs(supabase)

  const { data: pendingJobs, error: pendingError } = await supabase
    .from('scoring_jobs')
    .select('id, match_id, attempts')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(batchSize)

  if (pendingError) {
    return NextResponse.json({ error: 'Could not load scoring jobs.' }, { status: 500 })
  }

  if (!pendingJobs || pendingJobs.length === 0) {
    return NextResponse.json({ ok: true, jobsPicked: 0, betsUpdated: 0, roomPlayersUpdated: 0 })
  }

  const pickedIds = pendingJobs.map((job) => job.id)

  const { data: processingJobs, error: processingError } = await supabase
    .from('scoring_jobs')
    .update({
      status: 'processing',
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .in('id', pickedIds)
    .eq('status', 'pending')
    .select('id, match_id, attempts')

  if (processingError) {
    return NextResponse.json({ error: 'Could not lock scoring jobs.' }, { status: 500 })
  }

  if (!processingJobs || processingJobs.length === 0) {
    return NextResponse.json({ ok: true, jobsPicked: 0, betsUpdated: 0, roomPlayersUpdated: 0 })
  }

  const lockedMatchIds = processingJobs.map((job) => job.match_id)

  const { data: betsRows, error: betsError } = await supabase
    .from('bets')
    .select(
      'id, room_id, user_id, match_id, home_score, away_score, points, rooms!inner(rules, created_at, room_end_at), matches!inner(status, scheduled_start_at, home_score_ft, away_score_ft)'
    )
    .in('match_id', lockedMatchIds)

  if (betsError) {
    await supabase
      .from('scoring_jobs')
      .update({
        status: 'failed',
        last_error: 'Could not load bets for scoring.',
        finished_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .in('id', processingJobs.map((job) => job.id))

    return NextResponse.json({ error: 'Could not load bets for scoring.' }, { status: 500 })
  }

  const betUpdates: Array<{ id: string; points: number }> = []
  const roomUserDelta = new Map<string, { roomId: string; userId: string; delta: number }>()

  for (const raw of (betsRows ?? []) as BetWithRelations[]) {
    const match = pickOne(raw.matches)
    const room = pickOne(raw.rooms)
    if (!match || !room) continue
    if (match.status !== 'finished') continue
    if (new Date(match.scheduled_start_at).getTime() < new Date(room.created_at).getTime()) continue
    if (room.room_end_at && new Date(match.scheduled_start_at).getTime() > new Date(room.room_end_at).getTime()) continue

    const actualHome = match.home_score_ft
    const actualAway = match.away_score_ft
    if (actualHome === null || actualAway === null) continue

    const newPoints = calculatePoints(raw.home_score, raw.away_score, actualHome, actualAway, room.rules ?? {})
    const oldPoints = raw.points ?? 0
    const delta = newPoints - oldPoints

    if (delta !== 0 || raw.points === null) {
      betUpdates.push({
        id: raw.id,
        points: newPoints,
      })
    }

    if (delta !== 0) {
      const key = `${raw.room_id}:${raw.user_id}`
      const current = roomUserDelta.get(key)
      if (current) {
        current.delta += delta
      } else {
        roomUserDelta.set(key, {
          roomId: raw.room_id,
          userId: raw.user_id,
          delta,
        })
      }
    }
  }

  if (betUpdates.length > 0) {
    for (const update of betUpdates) {
      const { error: betUpdateError } = await supabase
        .from('bets')
        .update({ points: update.points })
        .eq('id', update.id)

      if (betUpdateError) {
        await supabase
          .from('scoring_jobs')
          .update({
            status: 'failed',
            last_error: `Could not update bet points: ${betUpdateError.message}`,
            finished_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .in('id', processingJobs.map((job) => job.id))

        return NextResponse.json({ error: 'Could not update bet points.', details: betUpdateError.message }, { status: 500 })
      }
    }
  }

    console.log(`[score-finished] Processed ${betUpdates.length} bet updates, ${roomUserDelta.size} room-user deltas`)
  const deltaEntries = [...roomUserDelta.values()]

  if (deltaEntries.length > 0) {
    const roomIds = [...new Set(deltaEntries.map((entry) => entry.roomId))]
    const userIds = [...new Set(deltaEntries.map((entry) => entry.userId))]

    const { data: roomPlayers, error: roomPlayersError } = await supabase
      .from('room_players')
      .select('id, room_id, user_id, points')
      .in('room_id', roomIds)
      .in('user_id', userIds)

    if (roomPlayersError) {
      return NextResponse.json({ error: 'Could not load room players for point updates.' }, { status: 500 })
    }

    const byKey = new Map((roomPlayers ?? []).map((row) => [`${row.room_id}:${row.user_id}`, row]))

    for (const entry of deltaEntries) {
      const row = byKey.get(`${entry.roomId}:${entry.userId}`)
      if (!row) continue

      const { error: rpUpdateError } = await supabase
        .from('room_players')
        .update({ points: row.points + entry.delta })
        .eq('id', row.id)

      if (rpUpdateError) {
        return NextResponse.json({ error: 'Could not update room player points.' }, { status: 500 })
      }
    }
  }

  const { error: completeError } = await supabase
    .from('scoring_jobs')
    .update({
      status: 'completed',
      attempts: 1,
      last_error: null,
      finished_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .in('id', processingJobs.map((job) => job.id))

  if (completeError) {
    return NextResponse.json({ error: 'Could not complete scoring jobs.' }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    jobsPicked: processingJobs.length,
    betsUpdated: betUpdates.length,
    roomPlayersUpdated: deltaEntries.length,
  })
}

export async function GET(request: NextRequest) {
  return processScoringJobs(request)
}

export async function POST(request: NextRequest) {
  return processScoringJobs(request)
}
