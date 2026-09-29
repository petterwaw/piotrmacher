import { isAuthorizedCronRequest } from '@/app/utils/cron/auth'
import { deactivateFinishedEvents } from '@/app/utils/jobs/deactivateFinishedEvents'
import { scorePickem } from '@/app/utils/jobs/scorePickem'
import { finishExpiredRooms, syncMatches } from '@/app/utils/jobs/syncMatches'
import { backfillMissingScoringJobs, processPendingScoringJobs } from '@/app/utils/scoring/processPendingScoringJobs'
import { createServiceRoleSupabaseClient } from '@/app/utils/supabase/service'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

type Job = 'sync' | 'score' | 'pickem' | 'deactivate'
const ALL_JOBS: Job[] = ['sync', 'score', 'pickem', 'deactivate']

function selectedJobs(request: NextRequest): Set<Job> {
  const raw = request.nextUrl.searchParams.get('jobs')
  if (raw) {
    return new Set(raw.split(',').filter((job): job is Job => ALL_JOBS.includes(job as Job)))
  }

  // Default run every ~5 min; event deactivation once a day (03:00–03:09 UTC).
  const now = new Date()
  const jobs = new Set<Job>(['sync', 'score', 'pickem'])
  if (now.getUTCHours() === 3 && now.getUTCMinutes() < 10) jobs.add('deactivate')
  return jobs
}

// Single entry point for scheduled work, called by Supabase pg_cron (pg_net).
async function runTick(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const jobs = selectedJobs(request)
  const supabase = createServiceRoleSupabaseClient()
  const result: Record<string, unknown> = {}

  if (jobs.has('deactivate')) {
    result.deactivate = await deactivateFinishedEvents(supabase)
  }

  if (jobs.has('sync')) {
    await finishExpiredRooms(supabase)
    try {
      result.sync = await syncMatches(supabase, { force: request.nextUrl.searchParams.get('force') === '1' })
    } catch (error) {
      result.sync = { error: error instanceof Error ? error.message : 'Sync failed' }
    }
  }

  if (jobs.has('score')) {
    const backfilled = await backfillMissingScoringJobs(supabase)
    result.score = { backfilled, ...(await processPendingScoringJobs(supabase, 100)) }
  }

  if (jobs.has('pickem')) {
    result.pickem = await scorePickem(supabase)
  }

  console.log('[tick]', JSON.stringify(result))
  return NextResponse.json({ ok: true, ...result })
}

export async function GET(request: NextRequest) {
  return runTick(request)
}

export async function POST(request: NextRequest) {
  return runTick(request)
}
