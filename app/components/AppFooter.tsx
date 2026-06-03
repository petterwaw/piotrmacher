'use client'

import { usePathname } from 'next/navigation'

function isRoomRoute(pathname: string): boolean {
  return /^\/home\/[^/]+(?:\/.*)?$/.test(pathname)
}

export default function AppFooter() {
  const pathname = usePathname()
  const isRoom = isRoomRoute(pathname)

  if (isRoom) {
    return (
      <footer className="hidden border-t border-zinc-300 bg-transparent md:block md:pb-0">
        <div className="mx-auto w-full max-w-[1320px] px-4 py-4 text-sm text-text-muted md:px-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <p className="font-semibold text-text-main">Piotrmacher</p>
            <p>
              Found a bug? Send details to{' '}
              <a className="font-semibold text-brand hover:text-brand-hover" href="mailto:piotrmachersupport@gmail.com">
                piotrmachersupport@gmail.com
              </a>
            </p>
          </div>
        </div>
      </footer>
    )
  }

  return (
    <footer className="border-t border-zinc-300 bg-transparent pb-0 md:pb-0">
      <div className="mx-auto w-full max-w-[1320px] px-4 py-4 text-sm text-text-muted md:px-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <p className="font-semibold text-text-main">Piotrmacher</p>
          <p>
            Found a bug? Send details to{' '}
            <a className="font-semibold text-brand hover:text-brand-hover" href="mailto:piotrmachersupport@gmail.com">
              piotrmachersupport@gmail.com
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
}
