'use client'

import { useEffect, useRef, type RefObject } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function isVisible(element: HTMLElement) {
  return element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden'
}

/**
 * Modal dialog keyboard behaviour (WAI-ARIA APG dialog pattern):
 * - moves focus into the dialog when it opens (`[data-autofocus]`, else the
 *   first focusable element, else the dialog itself);
 * - keeps Tab / Shift+Tab inside the dialog;
 * - calls `onClose` on Escape (omit it when the caller already handles Escape);
 * - returns focus to the element that opened the dialog when it closes.
 */
export function useDialogFocus(
  dialogRef: RefObject<HTMLElement | null>,
  open: boolean,
  onClose?: () => void
) {
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!open) return
    const dialog = dialogRef.current
    if (!dialog) return

    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null

    if (!dialog.contains(document.activeElement)) {
      const target =
        dialog.querySelector<HTMLElement>('[data-autofocus]') ??
        Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).find(isVisible) ??
        dialog
      target.focus()
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && onCloseRef.current) {
        event.stopPropagation()
        onCloseRef.current()
        return
      }

      if (event.key !== 'Tab') return

      const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(isVisible)
      if (items.length === 0) {
        event.preventDefault()
        dialog.focus()
        return
      }

      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      const outside = !dialog.contains(active)

      if (event.shiftKey && (active === first || active === dialog || outside)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (active === last || outside)) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      if (opener && opener.isConnected) {
        opener.focus()
      }
    }
  }, [dialogRef, open])
}
