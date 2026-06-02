import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

type ApiFixture = {
  fixture?: {
    date?: string
    status?: {
      short?: string
    }
  }
}

type EventRow = {
  id: string
  name: string
  season: string
  provider_event_id: string
}

const FINISHED_CODES = new Set(['FT', 'AET', 'PEN', 'CANC', 'ABD'])

function isFinishedFixture(fixture: ApiFixture | undefined): boolean {
  const short = fixture?.fixture?.status?.short
  if (!short) return false
  return FINISHED_CODES.has(short)
}

async function fetchFixtures(
  apiHost: string,
  apiKey: string,
  providerEventId: string,
  season: string,
  kind: 'next' | 'last'
) {
  const url = new URL(`https://${apiHost}/fixtures`)
  url.searchParams.set('league', providerEventId)
  url.searchParams.set('season', season)
  url.searchParams.set(kind, '1')

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'x-apisports-key': apiKey,
    },
  })

  if (!response.ok) {
    return { ok: false, fixtures: [] as ApiFixture[] }
  }

  const body = (await response.json().catch(() => ({}))) as { response?: ApiFixture[] }
  return { ok: true, fixtures: body.response ?? [] }
}

async function runDeactivation(request: NextRequest) {
  const auth = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const apiKey = process.env.FOOTBALL_API_KEY
  const apiHost = process.env.FOOTBALL_API_HOST || 'v3.football.api-sports.io'

  if (!supabaseUrl || !serviceRoleKey || !apiKey) {
    return NextResponse.json(
      { error: 'Missing env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or FOOTBALL_API_KEY' },
      { status: 500 }
    )
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const { data: activeEvents, error: activeEventsError } = await supabase
    .from('events')
    .select('id, name, season, provider_event_id')
    .eq('provider', 'api-football')
    .eq('is_active', true)

  if (activeEventsError) {
    return NextResponse.json({ error: 'Could not load active events.' }, { status: 500 })
  }

  const toDeactivate: string[] = []
  const skipped: Array<{ eventId: string; reason: string }> = []

  for (const event of (activeEvents ?? []) as EventRow[]) {
    if (!event.provider_event_id) {
      skipped.push({ eventId: event.id, reason: 'Missing provider_event_id' })
      continue
    }

    const [nextFixturesResult, lastFixturesResult] = await Promise.all([
      fetchFixtures(apiHost, apiKey, event.provider_event_id, event.season, 'next'),
      fetchFixtures(apiHost, apiKey, event.provider_event_id, event.season, 'last'),
    ])

    if (!nextFixturesResult.ok || !lastFixturesResult.ok) {
      skipped.push({ eventId: event.id, reason: 'Provider request failed' })
      continue
    }

    const hasUpcoming = nextFixturesResult.fixtures.length > 0
    const lastFixture = lastFixturesResult.fixtures[0]

    if (!lastFixture) {
      continue
    }

    const lastDateRaw = lastFixture.fixture?.date
    const lastDate = lastDateRaw ? new Date(lastDateRaw) : null
    const isInPast = lastDate ? lastDate.getTime() <= Date.now() : false

    if (!hasUpcoming && isInPast && isFinishedFixture(lastFixture)) {
      toDeactivate.push(event.id)
    }
  }

  if (toDeactivate.length > 0) {
    const { error: deactivateError } = await supabase
      .from('events')
      .update({ is_active: false })
      .in('id', toDeactivate)

    if (deactivateError) {
      return NextResponse.json({ error: 'Could not deactivate finished events.' }, { status: 500 })
    }
  }

  return NextResponse.json({
    ok: true,
    checked: (activeEvents ?? []).length,
    deactivated: toDeactivate.length,
    skipped,
  })
}

export async function GET(request: NextRequest) {
  return runDeactivation(request)
}

export async function POST(request: NextRequest) {
  return runDeactivation(request)
}
