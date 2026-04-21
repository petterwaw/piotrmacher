export type Prediction = {
  home: number
  away: number
}

type PredictionMap = Record<string, Prediction>

const STORAGE_KEY = 'mock_predictions'

function readStore(): PredictionMap {
  if (typeof window === 'undefined') {
    return {}
  }

  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return {}
  }

  try {
    return JSON.parse(raw) as PredictionMap
  } catch {
    return {}
  }
}

function writeStore(store: PredictionMap) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

export function getMockPrediction(matchId: string) {
  const store = readStore()
  return store[matchId] ?? null
}

export function saveMockPrediction(matchId: string, prediction: Prediction) {
  const store = readStore()
  const nextStore: PredictionMap = {
    ...store,
    [matchId]: prediction,
  }

  writeStore(nextStore)

  return prediction
}
