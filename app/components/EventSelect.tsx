import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { usePresence } from '@/app/components/motion/usePresence'

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
  // Keyboard-highlighted option while the list is open (select-only combobox:
  // focus stays on the button, aria-activedescendant points at the option).
  const [activeIndex, setActiveIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const listId = useId()
  const optionId = (index: number) => `${listId}-option-${index}`

  const selectedOption = options.find((opt) => opt.id === value)
  const selectedIndex = options.findIndex((opt) => opt.id === value)
  const isDisabled = disabled || loading

  const openList = () => {
    if (isDisabled) return
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0)
    setOpen(true)
  }

  const choose = (index: number) => {
    const option = options[index]
    if (option) onChange(option.id)
    setOpen(false)
  }

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (isDisabled) return

    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
        event.preventDefault()
        openList()
      }
      return
    }

    const last = options.length - 1
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        setActiveIndex((index) => Math.min(last, index + 1))
        break
      case 'ArrowUp':
        event.preventDefault()
        setActiveIndex((index) => Math.max(0, index - 1))
        break
      case 'Home':
        event.preventDefault()
        setActiveIndex(0)
        break
      case 'End':
        event.preventDefault()
        setActiveIndex(last)
        break
      case 'Enter':
      case ' ':
        event.preventDefault()
        choose(activeIndex)
        break
      case 'Escape':
        // Close only the list, not a dialog the select sits in.
        event.preventDefault()
        event.stopPropagation()
        setOpen(false)
        break
      case 'Tab':
        setOpen(false)
        break
    }
  }
  // The list stays mounted for its exit animation.
  const list = usePresence(open && !isDisabled)

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
    const active =
      listRef.current.querySelector<HTMLElement>('[data-active="true"]') ??
      listRef.current.querySelector<HTMLElement>('[data-selected="true"]')
    active?.scrollIntoView({ block: 'nearest' })
  }, [open, activeIndex])

  return (
    <div ref={containerRef} className="relative">
      <button
        id={id}
        type="button"
        role="combobox"
        onClick={() => { if (open) setOpen(false); else openList() }}
        onKeyDown={handleKeyDown}
        disabled={isDisabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && activeIndex >= 0 && options[activeIndex] ? optionId(activeIndex) : undefined}
        className={`no-press flex min-h-12 w-full items-center justify-between gap-3 border-2 px-4 py-3 text-left text-sm outline-none transition-colors focus-visible:border-brand ${
          isDisabled
            ? 'cursor-not-allowed border-zinc-300 bg-gray-100 text-text-muted'
            : open
              ? 'cursor-pointer border-brand bg-white text-text-main'
              : 'cursor-pointer border-zinc-300 bg-white text-text-main hover:border-brand'
        }`}
      >
        <span className={`truncate ${selectedOption ? 'font-medium text-text-main' : 'text-zinc-600'}`}>
          {loading ? 'Loading events…' : (selectedOption?.displayName ?? 'Select event')}
        </span>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={`shrink-0 text-zinc-600 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {list.value ? (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label="Events"
          className={`${list.isClosing ? 'animate-pop-out' : 'animate-pop-in'} absolute left-0 right-0 z-50 mt-1 max-h-56 overflow-y-auto border-2 border-brand bg-white shadow-lg shadow-black/10`}
        >
          {options.length === 0 ? (
            <li className="px-4 py-3 text-sm text-text-muted">No events available</li>
          ) : (
            options.map((opt, index) => {
              const isSelected = opt.id === value
              const isActive = index === activeIndex
              return (
                <li
                  key={opt.id}
                  id={optionId(index)}
                  role="option"
                  aria-selected={isSelected}
                  data-selected={isSelected ? 'true' : undefined}
                  data-active={isActive ? 'true' : undefined}
                  onClick={() => choose(index)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`flex min-h-11 cursor-pointer items-center justify-between gap-3 px-4 py-2.5 text-sm transition-colors ${
                    isSelected
                      ? 'bg-brand-tint font-semibold text-brand'
                      : 'text-text-main hover:bg-zinc-100'
                  } ${isActive ? 'outline-2 -outline-offset-2 outline-brand' : ''}`}
                >
                  {opt.displayName}
                  {isSelected ? <Check size={16} aria-hidden="true" className="shrink-0 text-brand" /> : null}
                </li>
              )
            })
          )}
        </ul>
      ) : null}
    </div>
  )
}
