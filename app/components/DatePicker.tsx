import { Calendar, ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

type Props = {
  value: string // YYYY-MM-DDTHH:mm (datetime-local format)
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
  inline?: boolean
}

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
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
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
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

  const calendarContent = (
    <div className={inline ? 'border-2 border-zinc-300 bg-white' : 'absolute left-0 right-0 z-50 mt-0.5 border-2 border-brand bg-white shadow-lg'}>
      {/* Month navigation */}
      <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2">
        <button type="button" onClick={prevMonth} className="p-1 text-text-muted transition-colors hover:text-text-main">
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-semibold text-text-main">{MONTHS[viewMonth]} {viewYear}</span>
        <button type="button" onClick={nextMonth} className="p-1 text-text-muted transition-colors hover:text-text-main">
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 px-2 pt-2">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1 text-center text-[11px] font-semibold uppercase tracking-wide text-text-muted">{d}</div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 px-2 pb-2">
        {cells.map((day, idx) => (
          <div key={idx} className="flex items-center justify-center p-0.5">
            {day ? (
              <button
                type="button"
                onClick={() => handleDayClick(day)}
                disabled={disabled}
                className={`h-8 w-8 text-sm font-medium transition-colors disabled:opacity-40 ${
                  isSelected(day)
                    ? 'bg-brand text-white'
                    : isToday(day)
                      ? 'border border-brand text-brand hover:bg-brand/10'
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
        <Clock size={14} className="shrink-0 text-text-muted" />
        <span className="text-xs text-text-muted">Time:</span>
        <input
          type="number"
          min={0}
          max={23}
          value={hour}
          disabled={disabled}
          onChange={(e) => { setHour(e.target.value); commitTime(e.target.value, minute, selYear, selMonth, selDay) }}
          className="w-12 border border-zinc-300 px-2 py-1 text-center text-sm outline-none focus:border-brand disabled:bg-gray-100"
        />
        <span className="text-text-muted">:</span>
        <input
          type="number"
          min={0}
          max={59}
          value={minute}
          disabled={disabled}
          onChange={(e) => { setMinute(e.target.value); commitTime(hour, e.target.value, selYear, selMonth, selDay) }}
          className="w-12 border border-zinc-300 px-2 py-1 text-center text-sm outline-none focus:border-brand disabled:bg-gray-100"
        />
        {!inline ? (
          <button type="button" onClick={() => setOpen(false)} className="ml-auto text-xs font-semibold text-brand hover:underline">
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
        className={`flex w-full items-center gap-3 border-2 px-4 py-3 text-left text-sm outline-none transition-colors ${
          disabled
            ? 'cursor-not-allowed border-zinc-300 bg-gray-100 text-text-muted'
            : open
              ? 'border-brand bg-white text-text-main'
              : 'border-zinc-300 bg-white text-text-main hover:border-brand'
        }`}
      >
        <Calendar size={15} className="shrink-0 text-text-muted" />
        <span className={value ? 'text-text-main' : 'text-text-muted'}>
          {value ? formatDisplay(value) : placeholder}
        </span>
      </button>

      {open && !disabled ? calendarContent : null}
    </div>
  )
}
