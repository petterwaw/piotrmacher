import { MatchesSkeleton } from '@/app/components/LoadingSkeletons'

export default function Loading() {
  return (
    <div className="mx-auto max-w-xl">
      <MatchesSkeleton cards={3} />
    </div>
  )
}