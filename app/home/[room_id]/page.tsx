import ScorePredictionCard from '@/app/components/ScorePredictionCard'
import { sampleMatch } from '@/app/data/matches.mock'
import { createServerSupabaseClient } from '@/app/utils/supabase/server'

export default async function BetsPage({
  params,
}: {
  params: Promise<{ room_id: string }>
}) {
  const { room_id } = await params
  const supabase = await createServerSupabaseClient()

  const { data: room } = await supabase
    .from('rooms')
    .select('status')
    .eq('id', room_id)
    .maybeSingle()

  const status = (room?.status as 'waiting' | 'active' | 'finished' | undefined) ?? 'waiting'

  return (
    <div>
      <h2 className="text-2xl font-bold text-text-main mb-6">Available Bets</h2>
      <ScorePredictionCard match={sampleMatch} roomStatus={status} />
    </div>
  )
}