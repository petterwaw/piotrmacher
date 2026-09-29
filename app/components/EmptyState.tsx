import type { LucideIcon } from 'lucide-react'

/**
 * Presentational empty state shared by room pages (bets, history, standings).
 * Keeps the brutalist frame of the cards but with a dashed border so it reads
 * as "nothing here yet" rather than as a card with missing content.
 */
export default function EmptyState({
  icon: Icon,
  title,
  hint,
}: {
  icon: LucideIcon
  title: string
  hint?: string
}) {
  return (
    <div className="animate-enter flex flex-col items-center border-2 border-dashed border-zinc-300 bg-white/60 px-6 py-12 text-center">
      <Icon size={32} strokeWidth={1.75} aria-hidden="true" className="text-zinc-400" />
      <p className="mt-3 text-base font-bold text-text-main">{title}</p>
      {hint ? <p className="mt-1 max-w-[40ch] text-sm text-zinc-600">{hint}</p> : null}
    </div>
  )
}
