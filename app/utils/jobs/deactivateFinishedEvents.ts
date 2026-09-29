import 'server-only'
import { cacheTags, invalidateCacheTags } from '@/app/utils/cache/tags'
import type { createServiceRoleSupabaseClient } from '@/app/utils/supabase/service'
import { ESPN_PROVIDER, fetchEspnLastMatchDay } from '@/app/utils/providers/espn'

type ServiceSupabaseClient = ReturnType<typeof createServiceRoleSupabaseClient>

// Leagues and club cups roll over into the next season under the same ESPN
// slug, so only one-off tournaments are ever closed automatically.
const ONE_OFF_TOURNAMENTS = new Set(['fifa.world', 'uefa.euro', 'conmebol.america', 'fifa.cwc'])

export async function deactivateFinishedEvents(supabase: ServiceSupabaseClient) {
  const { data: events, error } = await supabase
    .from('events')
    .select('id, provider_event_id')
    .eq('provider', ESPN_PROVIDER)
    .eq('is_active', true)

  if (error) {
    return { ok: false as const, error: 'Could not load active events.' }
  }

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const toDeactivate: string[] = []
  const skipped: Array<{ eventId: string; reason: string }> = []

  for (const event of events ?? []) {
    if (!event.provider_event_id || !ONE_OFF_TOURNAMENTS.has(event.provider_event_id)) continue

    try {
      const lastMatchDay = await fetchEspnLastMatchDay(event.provider_event_id)
      if (lastMatchDay && lastMatchDay < yesterday) toDeactivate.push(event.id)
    } catch (fetchError) {
      skipped.push({
        eventId: event.id,
        reason: fetchError instanceof Error ? fetchError.message : 'Provider request failed',
      })
    }
  }

  if (toDeactivate.length > 0) {
    const { error: updateError } = await supabase
      .from('events')
      .update({ is_active: false })
      .in('id', toDeactivate)

    if (updateError) {
      return { ok: false as const, error: 'Could not deactivate finished events.' }
    }

    invalidateCacheTags([cacheTags.activeEvents])
  }

  return { ok: true as const, checked: (events ?? []).length, deactivated: toDeactivate.length, skipped }
}
