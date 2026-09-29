import { Check, Minus } from 'lucide-react'
import type { PointsLine } from './points'

// One scored pick, rule by rule. Used by the worked examples and the tester.
export default function Breakdown({ lines, total }: { lines: PointsLine[]; total: number }) {
  return (
    <div>
      <ul className="divide-y divide-zinc-200">
        {lines.map((line) => (
          <li key={line.key} className="flex items-baseline gap-2.5 py-2 text-sm">
            {line.hit ? (
              <Check size={16} strokeWidth={3} aria-hidden="true" className="relative top-[3px] shrink-0 text-brand" />
            ) : (
              <Minus size={16} strokeWidth={2.5} aria-hidden="true" className="relative top-[3px] shrink-0 text-zinc-400" />
            )}
            <span className="min-w-0 flex-1">
              <span className={line.hit ? 'font-semibold text-text-main' : 'text-zinc-600'}>{line.label}</span>
              <span className="text-zinc-600">
                <span aria-hidden="true"> · </span>
                <span className="sr-only">, </span>
                {line.detail}
              </span>
            </span>
            <span className={`shrink-0 tabular-nums ${line.hit ? 'font-bold text-brand' : 'text-zinc-500'}`}>
              {line.hit ? `+${line.pts}` : '0'}
            </span>
          </li>
        ))}
      </ul>
      <p className="flex items-baseline justify-between gap-3 border-t-2 border-text-main pt-2 text-base font-black text-text-main">
        <span>Total</span>
        <span className="tabular-nums">{total} pts</span>
      </p>
    </div>
  )
}
