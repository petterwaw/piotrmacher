import { MatchesSkeleton } from '@/app/components/LoadingSkeletons'

export default function Loading() {
  // The skeleton's ViewTransition must be the outermost node, so the width
  // wrapper is passed in rather than rendered around it.
  return <MatchesSkeleton className="mx-auto max-w-xl" />
}
