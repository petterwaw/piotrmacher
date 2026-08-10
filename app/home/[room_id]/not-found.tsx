import Link from 'next/link'

export default function RoomNotFound() {
  return (
    <div className="flex w-full flex-1 items-center justify-center px-4 py-16 text-center">
      <div className="mx-auto w-full max-w-md">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#2E7D32]">Error 404</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-text-main md:text-4xl">
          Room not found
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-text-muted md:text-base">
          This room doesn&apos;t exist, or it was closed by the host. Check the invite link, or head back to your rooms.
        </p>

        <div className="mt-7">
          <Link
            href="/home"
            className="inline-flex min-h-12 items-center justify-center border border-brand bg-brand px-6 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:border-brand-hover hover:bg-brand-hover"
          >
            Go to rooms
          </Link>
        </div>
      </div>
    </div>
  )
}
