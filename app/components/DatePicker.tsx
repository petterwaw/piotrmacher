import { Calendar, ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { usePresence } from '@/app/components/motion/usePresence'

type Props = {
  value: string // YYYY-MM-DDTHH:mm (datetime-local format)
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
  inline?: boolean
}

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function formatDisplay(value: string): string {
  const [datePart, timePart] = value.split('T')
  if (!datePart) return ''
  const [year, month, day] = datePart.split('-')
  return `${day}.${month}.${year}${timePart ? ` ${timePart}` : ''}`
}

function toDatetimeLocal(year: number, month: number, day: number, hour: number, minute: number): string {
  return [
    `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
  ].join('T')
}

function parseValue(value: string) {
  if (!value) return null
  const [datePart, timePart] = value.split('T')
  const [y, m, d] = (datePart ?? '').split('-').map(Number)
  const [h, min] = (timePart ?? '00:00').split(':').map(Number)
  if (!y || !m || !d) return null
  return { year: y, month: m - 1, day: d, hour: h ?? 0, minute: min ?? 0 }
}

export default function DatePicker({
  value,
  onChange,
  disabled = false,
  placeholder = 'Select date & time',
  inline = false,
}: Props) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  // The popover stays mounted for its exit animation.
  const popover = usePresence(open && !disabled)
  // Direction of the last month change, so the day grid slides the right way.
  const [monthStep, setMonthStep] = useState<'prev' | 'next' | null>(null)

  const today = new Date()
  const parsed = parseValue(value)

  const [viewYear, setViewYear] = useState(parsed?.year ?? today.getFullYear())
  const [viewMonth, setViewMonth] = useState(parsed?.month ?? today.getMonth())

  const [selYear, setSelYear] = useState<number | null>(parsed?.year ?? null)
  const [selMonth, setSelMonth] = useState<number | null>(parsed?.month ?? null)
  const [selDay, setSelDay] = useState<number | null>(parsed?.day ?? null)
  const [hour, setHour] = useState(String(parsed?.hour ?? 12).padStart(2, '0'))
  const [minute, setMinute] = useState(String(parsed?.minute ?? 0).padStart(2, '0'))

  useEffect(() => {
    if (!open) return
    const onMouseDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const firstDayOffset = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const cells: Array<number | null> = [
    ...Array<null>(firstDayOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const prevMonth = () => {
    setMonthStep('prev')
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    setMonthStep('next')
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  const commitTime = (h: string, m: string, y: number | null, mo: number | null, d: number | null) => {
    if (y === null || mo === null || d === null) return
    const parsedH = Math.min(23, Math.max(0, Number.parseInt(h, 10) || 0))
    const parsedM = Math.min(59, Math.max(0, Number.parseInt(m, 10) || 0))
    onChange(toDatetimeLocal(y, mo, d, parsedH, parsedM))
  }

  const handleDayClick = (day: number) => {
    setSelYear(viewYear); setSelMonth(viewMonth); setSelDay(day)
    commitTime(hour, minute, viewYear, viewMonth, day)
  }

  const isToday = (d: number) =>
    d === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear()
  const isSelected = (d: number) =>
    d === selDay && viewMonth === selMonth && viewYear === selYear

  // Full date for each day button, so a screen reader hears
  // "Tuesday, 15 September 2026" rather than "15".
  const dayLabel = (d: number) =>
    `${WEEKDAY_NAMES[new Date(viewYear, viewMonth, d).getDay()]}, ${d} ${MONTHS[viewMonth]} ${viewYear}`

  const calendarContent = (
    <div
      role="group"
      aria-label="End date and time"
      className={inline ? 'border-2 border-zinc-300 bg-white' : `${popover.isClosing ? 'animate-pop-out' : 'animate-pop-in'} absolute left-0 right-0 z-50 mt-1 border-2 border-brand bg-white shadow-lg shadow-black/10`}
    >
      {/* Month navigation */}
      <div className="flex items-center justify-between border-b border-zinc-200 px-1.5 py-1">
        <button type="button" onClick={prevMonth} aria-label="Previous month" className="inline-flex h-9 w-9 items-center justify-center text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-text-main">
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <span aria-live="polite" className="text-sm font-bold tabular-nums text-text-main">{MONTHS[viewMonth]} {viewYear}</span>
        <button type="button" onClick={nextMonth} aria-label="Next month" className="inline-flex h-9 w-9 items-center justify-center text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-text-main">
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>

      {/* Weekday headers */}
      <div aria-hidden="true" className="grid grid-cols-7 px-2 pt-2">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1 text-center text-[11px] font-bold uppercase tracking-wide text-zinc-600">{d}</div>
        ))}
      </div>

      {/* Day grid: re-keyed per month so a month change slides in from its side. */}
      <div
        key={`${viewYear}-${viewMonth}`}
        className={`grid grid-cols-7 px-2 pb-2 ${monthStep === 'next' ? 'animate-month-next' : monthStep === 'prev' ? 'animate-month-prev' : ''}`}
      >
        {cells.map((day, idx) => (
          <div key={idx} className="flex items-center justify-center p-0.5">
            {day ? (
              <button
                type="button"
                onClick={() => handleDayClick(day)}
                disabled={disabled}
                aria-pressed={isSelected(day)}
                aria-current={isToday(day) ? 'date' : undefined}
                aria-label={dayLabel(day)}
                className={`h-9 w-9 text-sm font-medium tabular-nums transition-colors sm:h-10 sm:w-10 disabled:opacity-40 ${
                  isSelected(day)
                    ? 'bg-brand font-bold text-white'
                    : isToday(day)
                      ? 'border-2 border-brand font-bold text-brand hover:bg-brand-tint'
                      : 'text-text-main hover:bg-zinc-100'
                }`}
              >
                {day}
              </button>
            ) : null}
          </div>
        ))}
      </div>

      {/* Time picker */}
      <div className="flex items-center gap-2 border-t border-zinc-200 px-3 py-2.5">
        <Clock size={14} aria-hidden="true" className="shrink-0 text-zinc-600" />
        <span aria-hidden="true" className="text-xs font-semibold text-zinc-600">Time:</span>
        <input
          type="number"
          min={0}
          max={23}
          value={hour}
          aria-label="End time, hour"
          disabled={disabled}
          onChange={(e) => { setHour(e.target.value); commitTime(e.target.value, minute, selYear, selMonth, selDay) }}
          className="h-10 w-12 border-2 border-zinc-300 px-1 text-center text-sm font-semibold tabular-nums outline-none transition-colors focus:border-brand disabled:bg-gray-100"
        />
        <span aria-hidden="true" className="text-text-muted">:</span>
        <input
          type="number"
          min={0}
          max={59}
          value={minute}
          aria-label="End time, minute"
          disabled={disabled}
          onChange={(e) => { setMinute(e.target.value); commitTime(hour, e.target.value, selYear, selMonth, selDay) }}
          className="h-10 w-12 border-2 border-zinc-300 px-1 text-center text-sm font-semibold tabular-nums outline-none transition-colors focus:border-brand disabled:bg-gray-100"
        />
        {!inline ? (
          <button type="button" onClick={() => setOpen(false)} className="ml-auto inline-flex min-h-10 items-center px-2 text-sm font-semibold text-brand hover:underline">
            Done
          </button>
        ) : null}
      </div>
    </div>
  )

  if (inline) {
    return <div ref={containerRef}>{calendarContent}</div>
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => { if (!disabled) setOpen(p => !p) }}
        disabled={disabled}
        aria-expanded={open}
        className={`no-press flex min-h-12 w-full items-center gap-3 border-2 px-4 py-3 text-left text-sm outline-none transition-colors focus-visible:border-brand ${
          disabled
            ? 'cursor-not-allowed border-zinc-300 bg-gray-100 text-text-muted'
            : open
              ? 'border-brand bg-white text-text-main'
              : 'border-zinc-300 bg-white text-text-main hover:border-brand'
        }`}
      >
        <Calendar size={16} aria-hidden="true" className="shrink-0 text-zinc-600" />
        <span className={value ? 'text-text-main' : 'text-text-muted'}>
          {value ? formatDisplay(value) : placeholder}
        </span>
      </button>

      {popover.value ? calendarContent : null}
    </div>
  )
}
