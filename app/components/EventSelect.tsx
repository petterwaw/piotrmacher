import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

type Option = {
  id: string
  displayName: string
}

type Props = {
  id?: string
  value: string
  onChange: (value: string) => void
  options: Option[]
  disabled?: boolean
  loading?: boolean
}

export default function EventSelect({ id, value, onChange, options, disabled = false, loading = false }: Props) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const selectedOption = options.find((opt) => opt.id === value)
  const isDisabled = disabled || loading

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  useEffect(() => {
    if (!open || !listRef.current) return
    const active = listRef.current.querySelector<HTMLElement>('[data-selected="true"]')
    active?.scrollIntoView({ block: 'nearest' })
  }, [open])

  return (
    <div ref={containerRef} className="relative" id={id}>
      <button
        type="button"
        onClick={() => { if (!isDisabled) setOpen((prev) => !prev) }}
        disabled={isDisabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex w-full items-center justify-between border-2 px-4 py-3 text-left text-sm outline-none transition-colors ${
          isDisabled
            ? 'cursor-not-allowed border-zinc-300 bg-gray-100 text-text-muted'
            : open
              ? 'cursor-pointer border-brand bg-white text-text-main'
              : 'cursor-pointer border-zinc-300 bg-white text-text-main hover:border-brand'
        }`}
      >
        <span className={selectedOption ? 'text-text-main' : 'text-text-muted'}>
          {loading ? 'Loading events...' : (selectedOption?.displayName ?? 'Select event')}
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-text-muted transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && !isDisabled ? (
        <ul
          ref={listRef}
          role="listbox"
          className="absolute left-0 right-0 z-50 mt-0.5 max-h-56 overflow-y-auto border-2 border-brand bg-white shadow-lg"
        >
          {options.length === 0 ? (
            <li className="px-4 py-3 text-sm text-text-muted">No events available</li>
          ) : (
            options.map((opt) => {
              const isSelected = opt.id === value
              return (
                <li
                  key={opt.id}
                  role="option"
                  aria-selected={isSelected}
                  data-selected={isSelected ? 'true' : undefined}
                  onClick={() => { onChange(opt.id); setOpen(false) }}
                  className={`flex cursor-pointer items-center justify-between px-4 py-2.5 text-sm transition-colors ${
                    isSelected
                      ? 'bg-brand/5 font-medium text-brand'
                      : 'text-text-main hover:bg-zinc-100'
                  }`}
                >
                  {opt.displayName}
                  {isSelected ? <Check size={14} className="shrink-0 text-brand" /> : null}
                </li>
              )
            })
          )}
        </ul>
      ) : null}
    </div>
  )
}
