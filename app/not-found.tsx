import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex w-full flex-1 items-center justify-center px-4 py-20 md:px-6 md:py-28">
      <div className="mx-auto w-full max-w-[560px] text-center">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand">Error 404</p>
        <h1 className="mt-3 text-5xl font-black italic tracking-tight text-brand sm:text-6xl">
          OFFSIDE
        </h1>
        <p className="mt-5 text-base leading-relaxed text-text-muted md:text-lg">
          This page doesn&apos;t exist, or the whistle already blew on it. Let&apos;s get you back in play.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center">
          <Link
            href="/home"
            className="inline-flex min-h-12 items-center justify-center border border-brand bg-brand px-6 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:border-brand-hover hover:bg-brand-hover"
          >
            Go to rooms
          </Link>
          <Link
            href="/"
            className="inline-flex min-h-12 items-center justify-center border border-gray-300 bg-white px-6 text-sm font-bold uppercase tracking-wide text-text-main transition-colors hover:border-brand hover:text-brand"
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
  )
}
