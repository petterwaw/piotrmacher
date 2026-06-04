function SkeletonBlock({ className }: { className: string }) {
  return <div aria-hidden="true" className={`animate-pulse bg-zinc-200/80 ${className}`} />
}

export function StandingsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center justify-between border-2 border-zinc-300 bg-white/90 p-4">
          <div className="flex items-center gap-4">
            <SkeletonBlock className="h-7 w-10" />
            <SkeletonBlock className="h-5 w-32 md:w-40" />
          </div>
          <SkeletonBlock className="h-6 w-16" />
        </div>
      ))}
    </div>
  )
}

export function MatchCardSkeleton() {
  return (
    <div className="border-2 border-zinc-300 bg-white/90 p-5">
      <div className="mb-4 grid grid-cols-[1fr_auto_1fr] items-start gap-2">
        <div />
        <SkeletonBlock className="mx-auto h-4 w-32" />
        <div className="flex justify-end">
          <SkeletonBlock className="h-7 w-16" />
        </div>
      </div>

      <div className="flex flex-nowrap items-center justify-between gap-3 py-1">
        <div className="flex w-[38%] min-w-0 flex-col items-center text-center">
          <SkeletonBlock className="mb-2 h-12 w-12" />
          <SkeletonBlock className="h-4 w-24" />
        </div>

        <div className="w-[24%] min-w-[120px] text-center">
          <SkeletonBlock className="mx-auto h-9 w-20" />
        </div>

        <div className="flex w-[38%] min-w-0 flex-col items-center text-center">
          <SkeletonBlock className="mb-2 h-12 w-12" />
          <SkeletonBlock className="h-4 w-24" />
        </div>
      </div>

      <div className="mt-4 flex justify-end gap-3">
        <SkeletonBlock className="h-10 w-24" />
      </div>
    </div>
  )
}

export function MatchesSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div className="space-y-4">
      <div className="hide-scrollbar flex gap-2 overflow-x-auto pb-1">
        {Array.from({ length: 5 }, (_, index) => (
          <SkeletonBlock key={index} className="h-10 w-24 shrink-0 border-2 border-zinc-300" />
        ))}
      </div>

      <div className="space-y-4">
        {Array.from({ length: cards }, (_, index) => (
          <MatchCardSkeleton key={index} />
        ))}
      </div>
    </div>
  )
}

export function HistorySkeleton() {
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="space-y-4">
        {Array.from({ length: 3 }, (_, index) => (
          <MatchCardSkeleton key={index} />
        ))}
      </div>

      <div className="mt-6 flex items-center justify-center gap-2">
        <SkeletonBlock className="h-10 w-10 border border-border-soft" />
        <SkeletonBlock className="h-10 w-10 border border-border-soft" />
        <SkeletonBlock className="h-10 w-10 border border-border-soft" />
        <SkeletonBlock className="h-10 w-10 border border-border-soft" />
        <SkeletonBlock className="h-10 w-10 border border-border-soft" />
      </div>
    </div>
  )
}

export function RulesSkeleton() {
  return (
    <div>
      <div className="space-y-4 border-2 border-zinc-300 bg-white p-6">
        <div>
          <SkeletonBlock className="mb-2 h-7 w-40" />
          <div className="mb-4 border border-zinc-200 bg-zinc-50 p-3">
            <SkeletonBlock className="h-4 w-52 max-w-full" />
            <SkeletonBlock className="mt-2 h-4 w-72 max-w-full" />
          </div>

          <div className="space-y-2">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="border-b border-border-soft py-2">
                <div className="flex items-center justify-between gap-3">
                  <SkeletonBlock className="h-4 w-36 max-w-[70%]" />
                  <SkeletonBlock className="h-4 w-12" />
                </div>
                <div className="mt-2 space-y-1">
                  <SkeletonBlock className="h-3 w-full" />
                  <SkeletonBlock className="h-3 w-5/6" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 border-2 border-zinc-300 bg-zinc-50 p-4">
          <SkeletonBlock className="mb-4 h-4 w-28" />
          <div className="flex flex-col gap-4">
            <div className="grid min-w-0 gap-4 md:grid-cols-2">
              {Array.from({ length: 2 }, (_, index) => (
                <div key={index} className="min-w-0">
                  <SkeletonBlock className="mb-2 h-3 w-20" />
                  <div className="border-2 border-zinc-300 bg-white px-4 py-3">
                    <div className="flex items-center justify-center gap-4">
                      {Array.from({ length: 2 }, (_, scoreIndex) => (
                        <div key={scoreIndex} className="flex flex-col items-center gap-2">
                          <SkeletonBlock className="h-8 w-8" />
                          <SkeletonBlock className="h-8 w-8" />
                          <SkeletonBlock className="h-8 w-8" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="w-full border-2 border-zinc-300 bg-white p-3">
              <SkeletonBlock className="mb-3 h-3 w-24" />
              <div className="space-y-2">
                {Array.from({ length: 5 }, (_, index) => (
                  <div key={index} className="flex items-center justify-between gap-3">
                    <SkeletonBlock className="h-3 w-32 max-w-[70%]" />
                    <SkeletonBlock className="h-3 w-10" />
                  </div>
                ))}
                <div className="mt-2 flex items-center justify-between border-t border-zinc-300 pt-2">
                  <SkeletonBlock className="h-4 w-12" />
                  <SkeletonBlock className="h-4 w-14" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function SettingsSkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="border-2 border-zinc-300 bg-white p-5">
        <SkeletonBlock className="mb-3 h-4 w-24" />
        <div className="flex items-center justify-between gap-3">
          <SkeletonBlock className="h-10 flex-1" />
          <SkeletonBlock className="h-10 w-24 shrink-0" />
        </div>
      </div>

      <div className="border-2 border-zinc-300 bg-white p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <SkeletonBlock className="h-6 w-40" />
          <SkeletonBlock className="h-7 w-20" />
        </div>

        <div className="space-y-5">
          <div>
            <SkeletonBlock className="mb-2 h-3 w-28" />
            <SkeletonBlock className="h-11 w-full" />
          </div>

          <div>
            <SkeletonBlock className="mb-2 h-3 w-32" />
            <div className="flex flex-wrap gap-3">
              <SkeletonBlock className="h-10 w-32" />
              <SkeletonBlock className="h-10 w-36" />
            </div>
            <SkeletonBlock className="mt-3 h-11 w-full md:w-72" />
          </div>

          <div>
            <SkeletonBlock className="mb-3 h-5 w-28" />
            <div className="space-y-3">
              {Array.from({ length: 6 }, (_, index) => (
                <div key={index} className="grid gap-3 border border-zinc-200 p-3 md:grid-cols-[1fr_88px] md:items-start">
                  <div>
                    <SkeletonBlock className="mb-2 h-4 w-36 max-w-full" />
                    <SkeletonBlock className="h-3 w-full" />
                    <SkeletonBlock className="mt-1 h-3 w-5/6" />
                  </div>
                  <SkeletonBlock className="h-11 w-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-3">
        <SkeletonBlock className="h-11 w-28" />
        <SkeletonBlock className="h-11 w-36" />
      </div>
    </div>
  )
}

export function ProfileSkeleton() {
  return (
    <div className="mx-auto w-full max-w-xl space-y-4 px-4 py-8 md:px-6">
      <div className="border-2 border-zinc-300 bg-white/90 divide-y divide-zinc-200">
        <div className="px-4 py-3">
          <SkeletonBlock className="mb-2 h-3 w-14" />
          <SkeletonBlock className="h-4 w-48 max-w-full" />
        </div>

        <div className="px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <SkeletonBlock className="mb-2 h-3 w-20" />
              <SkeletonBlock className="h-4 w-32 max-w-full" />
            </div>
            <SkeletonBlock className="h-8 w-8 shrink-0 border-2 border-zinc-300" />
          </div>
        </div>

        <div className="px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <SkeletonBlock className="mb-2 h-3 w-20" />
              <SkeletonBlock className="h-4 w-24 max-w-full" />
            </div>
            <SkeletonBlock className="h-8 w-8 shrink-0 border-2 border-zinc-300" />
          </div>
        </div>

        <div className="px-4 py-3">
          <SkeletonBlock className="mb-2 h-3 w-24" />
          <SkeletonBlock className="h-4 w-36 max-w-full" />
        </div>
      </div>

      <section className="border-2 border-orange-400 bg-orange-50 p-5">
        <SkeletonBlock className="mb-3 h-6 w-36" />
        <SkeletonBlock className="h-4 w-full" />
        <SkeletonBlock className="mt-2 h-4 w-5/6" />
        <SkeletonBlock className="mt-4 h-10 w-full" />
        <SkeletonBlock className="mt-3 h-10 w-40" />
      </section>
    </div>
  )
}