import 'server-only'
import type { createServiceRoleSupabaseClient } from '@/app/utils/supabase/service'

type ServiceSupabaseClient = ReturnType<typeof createServiceRoleSupabaseClient>

type Rules = {
  correct_winner?: number
  correct_draw?: number
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

export type ScoringResult =
  | { ok: true; jobsPicked: number; betsUpdated: number; roomPlayersUpdated: number }
  | { ok: false; error: string; details?: string }

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
  const value = Number(rules[key])
  return Number.isFinite(value) && value > 0 ? value : 0
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

  if (predictedOutcome === 'draw' && actualOutcome === 'draw') {
    points += toRuleScore(rules, 'correct_draw')
  } else if (predictedOutcome === actualOutcome) {
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

const STALE_PROCESSING_MS = 10 * 60 * 1000
const MAX_ATTEMPTS = 5

// Room totals are always recomputed from bets + pickem picks in SQL, so a
// re-run can never double count and nothing depends on stored deltas.
export async function recomputeRoomPoints(supabase: ServiceSupabaseClient, roomIds: string[]) {
  if (roomIds.length === 0) return null
  const { error } = await supabase.rpc('recompute_room_player_points', { p_room_ids: roomIds })
  return error
}

// Safety net for finished matches with unscored bets but no scoring job
// (e.g. a job was lost or a bet was inserted by an admin later).
export async function backfillMissingScoringJobs(supabase: ServiceSupabaseClient) {
  const { data: unscoredBets, error } = await supabase
    .from('bets')
    .select('match_id, matches!inner(status)')
    .is('points', null)
    .eq('matches.status', 'finished')
    .limit(1000)

  if (error || !unscoredBets || unscoredBets.length === 0) return 0

  const matchIds = [...new Set(unscoredBets.map((row) => String(row.match_id)))]
  // Only create missing jobs; existing ones keep their status and attempt count.
  const { error: upsertError } = await supabase
    .from('scoring_jobs')
    .upsert(
      matchIds.map((matchId) => ({ match_id: matchId })),
      { onConflict: 'match_id', ignoreDuplicates: true }
    )

  return upsertError ? 0 : matchIds.length
}

export async function processPendingScoringJobs(supabase: ServiceSupabaseClient, batchSize = 50): Promise<ScoringResult> {
  const clampedBatchSize = Math.min(200, Math.max(1, Number.isFinite(batchSize) ? batchSize : 50))
  const staleBefore = new Date(Date.now() - STALE_PROCESSING_MS).toISOString()

  // Pending jobs, plus jobs stuck in 'processing' after a crashed run.
  const { data: candidateJobs, error: pendingError } = await supabase
    .from('scoring_jobs')
    .select('id, match_id, attempts, status')
    .or(`status.eq.pending,and(status.eq.processing,started_at.lt."${staleBefore}")`)
    .lt('attempts', MAX_ATTEMPTS)
    .order('created_at', { ascending: true })
    .limit(clampedBatchSize)

  if (pendingError) {
    return { ok: false, error: 'Could not load scoring jobs.' }
  }

  if (!candidateJobs || candidateJobs.length === 0) {
    return { ok: true, jobsPicked: 0, betsUpdated: 0, roomPlayersUpdated: 0 }
  }

  const nowIso = new Date().toISOString()
  const processingJobs: Array<{ id: string; match_id: string; attempts: number }> = []

  // Lock each job with a compare-and-set on its current status/attempts.
  for (const job of candidateJobs) {
    const { data: locked } = await supabase
      .from('scoring_jobs')
      .update({ status: 'processing', attempts: job.attempts + 1, started_at: nowIso, updated_at: nowIso })
      .eq('id', job.id)
      .eq('status', job.status)
      .eq('attempts', job.attempts)
      .select('id, match_id, attempts')
      .maybeSingle()

    if (locked) processingJobs.push(locked)
  }

  if (processingJobs.length === 0) {
    return { ok: true, jobsPicked: 0, betsUpdated: 0, roomPlayersUpdated: 0 }
  }

  const processingIds = processingJobs.map((job) => job.id)
  const lockedMatchIds = processingJobs.map((job) => job.match_id)

  const failJobs = async (message: string) => {
    await supabase
      .from('scoring_jobs')
      .update({
        status: 'pending',
        last_error: message,
        updated_at: new Date().toISOString(),
      })
      .in('id', processingIds)
  }

  const { data: betsRows, error: betsError } = await supabase
    .from('bets')
    .select(
      'id, room_id, user_id, match_id, home_score, away_score, points, rooms!inner(rules, created_at, room_end_at), matches!inner(status, scheduled_start_at, home_score_ft, away_score_ft)'
    )
    .in('match_id', lockedMatchIds)

  if (betsError) {
    await failJobs('Could not load bets for scoring.')
    return { ok: false, error: 'Could not load bets for scoring.' }
  }

  const betUpdates: Array<{ id: string; points: number }> = []
  const affectedRoomIds = new Set<string>()

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

    if (raw.points !== newPoints) {
      betUpdates.push({ id: raw.id, points: newPoints })
      affectedRoomIds.add(raw.room_id)
    }
  }

  for (const update of betUpdates) {
    const { error: betUpdateError } = await supabase
      .from('bets')
      .update({ points: update.points })
      .eq('id', update.id)

    if (betUpdateError) {
      await failJobs(`Could not update bet points: ${betUpdateError.message}`)
      return { ok: false, error: 'Could not update bet points.', details: betUpdateError.message }
    }
  }

  const recomputeError = await recomputeRoomPoints(supabase, [...affectedRoomIds])
  if (recomputeError) {
    await failJobs(`Could not recompute room points: ${recomputeError.message}`)
    return { ok: false, error: 'Could not recompute room points.', details: recomputeError.message }
  }

  console.log(`[scoring] Updated ${betUpdates.length} bets across ${affectedRoomIds.size} rooms`)

  const { error: completeError } = await supabase
    .from('scoring_jobs')
    .update({
      status: 'completed',
      last_error: null,
      finished_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .in('id', processingIds)

  if (completeError) {
    return { ok: false, error: 'Could not complete scoring jobs.' }
  }

  return {
    ok: true,
    jobsPicked: processingJobs.length,
    betsUpdated: betUpdates.length,
    roomPlayersUpdated: affectedRoomIds.size,
  }
}
