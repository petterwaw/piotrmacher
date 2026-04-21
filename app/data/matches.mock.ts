export type MatchStatus = 'scheduled' | 'delayed' | 'live' | 'finished'

export type MockMatch = {
  id: string
  homeTeam: string
  awayTeam: string
  startTime: string
  status: MatchStatus
  prediction: {
    home: number
    away: number
  } | null
}

export const sampleMatch: MockMatch = {
  id: 'match_1',
  homeTeam: 'Manchester United',
  awayTeam: 'Liverpool',
  startTime: '2026-04-15T20:00:00.000Z',
  status: 'scheduled',
  prediction: null,
}