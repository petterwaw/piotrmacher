type PickemEventEligibilityInput = {
  name?: string | null
  provider_event_id?: string | null
}

const DEFAULT_WORLD_CUP_PROVIDER_EVENT_IDS = ['1']

function parseConfiguredProviderEventIds() {
  const raw = process.env.PICKEM_WORLD_CUP_PROVIDER_EVENT_IDS?.trim()
  if (!raw) {
    return new Set(DEFAULT_WORLD_CUP_PROVIDER_EVENT_IDS)
  }

  const ids = raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)

  return new Set(ids.length > 0 ? ids : DEFAULT_WORLD_CUP_PROVIDER_EVENT_IDS)
}

const worldCupProviderEventIds = parseConfiguredProviderEventIds()

export function isWorldCupPickemEvent(event: PickemEventEligibilityInput | null | undefined) {
  if (!event) {
    return false
  }

  const normalizedName = (event.name ?? '').trim().toLowerCase()
  if (normalizedName.includes('world cup') || normalizedName.includes('mundial')) {
    return true
  }

  const providerEventId = (event.provider_event_id ?? '').trim()
  if (!providerEventId) {
    return false
  }

  return worldCupProviderEventIds.has(providerEventId)
}