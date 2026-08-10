import { createServiceRoleSupabaseClient } from '@/app/utils/supabase/service'
import { processPendingScoringJobs } from '@/app/utils/scoring/processPendingScoringJobs'
import { NextRequest, NextResponse } from 'next/server'

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

async function processScoringJobs(request: NextRequest) {
  const auth = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const batchSizeRaw = request.nextUrl.searchParams.get('batch')
  const batchSize = Math.min(200, Math.max(1, Number(batchSizeRaw || '50')))

  const supabase = createServiceRoleSupabaseClient()

  // Safety net: this cron also runs independently of sync-matches, so it
  // backfills any scoring_jobs that might have been missed (e.g. a bet was
  // placed after a match was already marked finished).
  await backfillMissingScoringJobs(supabase)

  const result = await processPendingScoringJobs(supabase, batchSize)

  if (!result.ok) {
    return NextResponse.json({ error: result.error, details: result.details }, { status: 500 })
  }

  return NextResponse.json(result)
}

export async function GET(request: NextRequest) {
  return processScoringJobs(request)
}

export async function POST(request: NextRequest) {
  return processScoringJobs(request)
}
