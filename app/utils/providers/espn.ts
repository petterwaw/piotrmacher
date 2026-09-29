import 'server-only'
// Unofficial, keyless ESPN endpoints. Undocumented, so parse defensively and
// keep everything provider-specific inside this file.
// Notes from testing against the live API (Sept 2026):
// - site.api.espn.com rejects requests from cloud IPs (Akamai 403);
//   site.web.api.espn.com serves the same data.
// - The scoreboard needs a User-Agent and rejects date *ranges* (400), so
//   fixtures are fetched one day at a time using the league's calendar.
const SCOREBOARD_BASE = 'https://site.web.api.espn.com/apis/site/v2/sports/soccer'
const STANDINGS_BASE = 'https://site.web.api.espn.com/apis/v2/sports/soccer'
const REQUEST_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'Mozilla/5.0 (compatible; piotrmacher/1.0; +https://piotrmacher.fun)',
}
const DAY_MS = 24 * 60 * 60 * 1000

export const ESPN_PROVIDER = 'espn'
export const ESPN_MATCH_ID_PREFIX = 'espn:'

export type MatchStatus = 'scheduled' | 'delayed' | 'live' | 'finished' | 'cancelled'
export type ResultMode = 'regular' | 'aet' | 'pens' | 'void'

export type ProviderFixture = {
  providerMatchId: string
  scheduledStartAt: string
  status: MatchStatus
  resultMode: ResultMode
  liveMinute: number | null
  homeTeam: string
  awayTeam: string
  homeLogo: string | null
  awayLogo: string | null
  // Score after 90 minutes (or the current score while live) — used for betting.
  homeScoreFt: number | null
  awayScoreFt: number | null
  homeScoreAet: number | null
  awayScoreAet: number | null
  homeScorePens: number | null
  awayScorePens: number | null
}

export type ProviderStandingRow = {
  groupName: string
  groupOrder: number
  teamId: string
  teamName: string
  teamLogo: string | null
  position: number
}

type EspnCompetitor = {
  homeAway?: string
  score?: string | number | null
  shootoutScore?: number | string | null
  linescores?: Array<{ value?: number | string | null }> | null
  team?: {
    id?: string | number
    displayName?: string
    name?: string
    logo?: string
    logos?: Array<{ href?: string }>
  }
}

type EspnStatus = {
  displayClock?: string
  type?: {
    name?: string
    state?: string
    completed?: boolean
  }
}

type EspnEvent = {
  id?: string | number
  date?: string
  status?: EspnStatus
  competitions?: Array<{
    date?: string
    status?: EspnStatus
    competitors?: EspnCompetitor[]
  }>
}

function toInt(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null
}

function isoDay(date: Date) {
  return date.toISOString().slice(0, 10)
}

export function toMatchStatus(status: EspnStatus | undefined): MatchStatus {
  const name = (status?.type?.name ?? '').toUpperCase()
  const state = (status?.type?.state ?? '').toLowerCase()

  if (name.includes('CANCEL') || name.includes('ABANDON') || name.includes('FORFEIT')) return 'cancelled'
  if (name.includes('POSTPONE') || name.includes('DELAY') || name.includes('SUSPEND')) return 'delayed'
  if (state === 'in') return 'live'
  if (state === 'post') return status?.type?.completed === false ? 'delayed' : 'finished'
  return 'scheduled'
}

export function toResultMode(status: EspnStatus | undefined, matchStatus: MatchStatus): ResultMode {
  if (matchStatus === 'cancelled') return 'void'
  if (matchStatus !== 'finished') return 'regular'

  const name = (status?.type?.name ?? '').toUpperCase()
  if (name.includes('PEN') || name.includes('SHOOTOUT')) return 'pens'
  if (name.includes('AET') || name.includes('EXTRA')) return 'aet'
  return 'regular'
}

function parseLiveMinute(status: EspnStatus | undefined): number | null {
  // displayClock looks like "67'" or "45'+2'".
  const minute = Number.parseInt(status?.displayClock ?? '', 10)
  return Number.isFinite(minute) && minute > 0 ? minute : null
}

// ESPN's `score` includes extra-time goals. Bets are settled on 90 minutes,
// so derive it from the first two periods when the match went to extra time.
function regulationScore(competitor: EspnCompetitor, total: number | null) {
  const periods = competitor.linescores ?? []
  if (periods.length >= 2) {
    const first = toInt(periods[0]?.value)
    const second = toInt(periods[1]?.value)
    if (first !== null && second !== null) return first + second
  }
  return total
}

function teamLogo(team: EspnCompetitor['team']): string | null {
  return team?.logo ?? team?.logos?.[0]?.href ?? null
}

export function parseEspnEvent(event: EspnEvent): ProviderFixture | null {
  const competition = event.competitions?.[0]
  const competitors = competition?.competitors ?? []
  const home = competitors.find((item) => item.homeAway === 'home')
  const away = competitors.find((item) => item.homeAway === 'away')
  const kickoff = event.date ?? competition?.date
  const kickoffDate = kickoff ? new Date(kickoff) : null

  if (!event.id || !home?.team || !away?.team || !kickoffDate || Number.isNaN(kickoffDate.getTime())) {
    return null
  }

  const status = event.status ?? competition?.status
  const matchStatus = toMatchStatus(status)
  let resultMode = toResultMode(status, matchStatus)

  const hasScore = matchStatus === 'live' || matchStatus === 'finished'
  const homeTotal = hasScore ? toInt(home.score) : null
  const awayTotal = hasScore ? toInt(away.score) : null

  let homeScoreFt = homeTotal
  let awayScoreFt = awayTotal
  let homeScoreAet: number | null = null
  let awayScoreAet: number | null = null
  let homeScorePens: number | null = null
  let awayScorePens: number | null = null

  if (resultMode === 'aet' || resultMode === 'pens') {
    homeScoreFt = regulationScore(home, homeTotal)
    awayScoreFt = regulationScore(away, awayTotal)
    homeScoreAet = homeTotal
    awayScoreAet = awayTotal
  }

  if (resultMode === 'pens') {
    homeScorePens = toInt(home.shootoutScore)
    awayScorePens = toInt(away.shootoutScore)
    // DB requires shootout scores for 'pens'; degrade rather than fail the upsert.
    if (homeScorePens === null || awayScorePens === null) {
      resultMode = 'aet'
      homeScorePens = null
      awayScorePens = null
    }
  }

  if (resultMode === 'aet' && (homeScoreAet === null || awayScoreAet === null)) {
    resultMode = 'regular'
  }

  return {
    providerMatchId: `${ESPN_MATCH_ID_PREFIX}${event.id}`,
    scheduledStartAt: kickoffDate.toISOString(),
    status: matchStatus,
    resultMode,
    liveMinute: matchStatus === 'live' ? parseLiveMinute(status) : null,
    homeTeam: home.team.displayName ?? home.team.name ?? 'Home',
    awayTeam: away.team.displayName ?? away.team.name ?? 'Away',
    homeLogo: teamLogo(home.team),
    awayLogo: teamLogo(away.team),
    homeScoreFt,
    awayScoreFt,
    homeScoreAet,
    awayScoreAet,
    homeScorePens,
    awayScorePens,
  }
}

async function getJson(url: URL): Promise<unknown> {
  const response = await fetch(url, {
    headers: REQUEST_HEADERS,
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  })

  if (!response.ok) {
    throw new Error(`ESPN responded with ${response.status} for ${url.pathname}`)
  }

  return response.json()
}

type EspnScoreboard = {
  events?: EspnEvent[]
  leagues?: Array<{
    calendarType?: string
    calendar?: unknown[]
    calendarEndDate?: string
  }>
}

function scoreboardUrl(leagueSlug: string, day?: string) {
  const url = new URL(`${SCOREBOARD_BASE}/${encodeURIComponent(leagueSlug)}/scoreboard`)
  if (day) url.searchParams.set('dates', day.replaceAll('-', ''))
  return url
}

async function getScoreboard(leagueSlug: string, day?: string) {
  return (await getJson(scoreboardUrl(leagueSlug, day))) as EspnScoreboard
}

// Match days ("YYYY-MM-DD") ESPN lists for the season, or null when the
// league uses a phase-based calendar (e.g. Champions League).
function calendarDays(scoreboard: EspnScoreboard): string[] | null {
  const league = scoreboard.leagues?.[0]
  if (league?.calendarType !== 'day' || !Array.isArray(league.calendar)) return null
  return league.calendar
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.slice(0, 10))
}

function everyDay(from: Date, to: Date) {
  const days: string[] = []
  for (let time = from.getTime(); time <= to.getTime(); time += DAY_MS) {
    days.push(isoDay(new Date(time)))
  }
  return days
}

export async function fetchEspnFixtures(leagueSlug: string, from: Date, to: Date): Promise<ProviderFixture[]> {
  // The default scoreboard gives the current match day plus the season calendar.
  const current = await getScoreboard(leagueSlug)
  const fromDay = isoDay(from)
  const toDay = isoDay(to)

  // ESPN days are US-based, so pad the window by a day on each side.
  const days = (calendarDays(current) ?? everyDay(new Date(from.getTime() - DAY_MS), new Date(to.getTime() + DAY_MS)))
    .filter((day) => day >= isoDay(new Date(from.getTime() - DAY_MS)) && day <= isoDay(new Date(to.getTime() + DAY_MS)))

  const eventsById = new Map<string, EspnEvent>()
  for (const event of current.events ?? []) {
    if (event.id) eventsById.set(String(event.id), event)
  }

  for (const day of new Set(days)) {
    const scoreboard = await getScoreboard(leagueSlug, day)
    for (const event of scoreboard.events ?? []) {
      if (event.id) eventsById.set(String(event.id), event)
    }
  }

  return [...eventsById.values()]
    .map(parseEspnEvent)
    .filter((fixture): fixture is ProviderFixture => fixture !== null)
    .filter((fixture) => {
      const day = fixture.scheduledStartAt.slice(0, 10)
      return day >= fromDay && day <= toDay
    })
}

// Last day with scheduled matches in the competition's current calendar.
export async function fetchEspnLastMatchDay(leagueSlug: string): Promise<string | null> {
  const scoreboard = await getScoreboard(leagueSlug)
  const days = calendarDays(scoreboard)
  if (days && days.length > 0) return days.reduce((latest, day) => (day > latest ? day : latest))

  const end = scoreboard.leagues?.[0]?.calendarEndDate
  return end ? end.slice(0, 10) : null
}
type EspnStandingsNode = {
  name?: string
  abbreviation?: string
  standings?: {
    entries?: Array<{
      team?: EspnCompetitor['team']
      stats?: Array<{ name?: string; type?: string; value?: number | string }>
    }>
  }
  children?: EspnStandingsNode[]
}

export async function fetchEspnStandings(leagueSlug: string): Promise<ProviderStandingRow[]> {
  const url = new URL(`${STANDINGS_BASE}/${encodeURIComponent(leagueSlug)}/standings`)
  const body = (await getJson(url)) as EspnStandingsNode

  // Tournaments return one child per group; plain leagues return a single table.
  const groups = Array.isArray(body?.children) && body.children.length > 0 ? body.children : [body]
  const rows: ProviderStandingRow[] = []

  groups.forEach((group, groupIndex) => {
    const entries = group?.standings?.entries ?? []
    const groupName = group?.name?.trim() || `Group ${groupIndex + 1}`

    entries.forEach((entry, entryIndex) => {
      const teamId = entry.team?.id === undefined ? '' : String(entry.team.id)
      const teamName = entry.team?.displayName ?? entry.team?.name
      if (!teamId || !teamName) return

      const rankStat = entry.stats?.find((stat) => stat.name === 'rank' || stat.type === 'rank')
      const rank = toInt(rankStat?.value)

      rows.push({
        groupName,
        groupOrder: groupIndex,
        teamId,
        teamName,
        teamLogo: teamLogo(entry.team),
        position: rank && rank > 0 ? rank : entryIndex + 1,
      })
    })
  })

  return rows
}
