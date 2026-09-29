'use client'

import { usePathname } from 'next/navigation'

function isRoomRoute(pathname: string): boolean {
  return /^\/home\/[^/]+(?:\/.*)?$/.test(pathname)
}

export default function AppFooter() {
  const pathname = usePathname()
  const isRoom = isRoomRoute(pathname)

  // Room pages use a fixed bottom tab bar on mobile, so the footer is desktop-only there.
  return (
    <footer className={`border-t border-zinc-300 bg-transparent ${isRoom ? 'hidden md:block' : ''}`}>
      <div className="mx-auto w-full max-w-[1320px] px-4 py-5 text-sm text-text-muted md:px-6">
        <div className="flex flex-col gap-1.5 md:flex-row md:items-center md:justify-between">
          <p className="font-bold text-text-main">Piotrmacher</p>
          <p>
            Found a bug? Send details to{' '}
            <a
              className="font-semibold text-brand underline decoration-brand/30 transition-colors hover:text-brand-hover hover:decoration-brand-hover"
              href="mailto:piotrmachersupport@gmail.com"
            >
              piotrmachersupport@gmail.com
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
}
