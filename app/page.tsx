import { createServerSupabaseClient } from '@/app/utils/supabase/server'
import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export default async function Home() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect('/home')
  }

  const flowSteps = [
    {
      stepLabel: 'Step 1',
      src: '/rooms.webp',
      title: 'Create or join a room',
      description: 'Start a private league with your friends or join an existing room in seconds.',
    },
    {
      stepLabel: 'Step 2',
      src: '/create.webp',
      title: 'Set up your room quickly',
      description: 'Name your room, pick the event, and launch the competition with a clean host flow.',
    },
    {
      stepLabel: 'Step 3',
      src: '/settings.webp',
      title: 'Set your own rules',
      description: 'Adjust scoring logic, room duration, and event settings before kickoff so everyone plays by the same structure.',
    },
    {
      stepLabel: 'Step 4',
      src: '/history.webp',
      title: 'Bet on matches with friends',
      description: 'Place score predictions round by round and compare picks with your group across every match card.',
    },
    {
      stepLabel: 'Step 5',
      src: '/standings.webp',
      title: 'Live Standings',
      description: 'Watch the table move after each result and always know who leads the room in real time.',
    },
  ]

  return (
    <div className="w-full">
      <section className="relative px-4 pb-14 pt-6 md:px-6 md:pb-20 md:pt-10">
        <div className="relative mx-auto grid w-full max-w-[1320px] gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center">
          <div>
            <div className="mb-5 inline-flex items-center border border-[#4CAF50]/30 bg-white/80 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-[#2E7D32]">
              Multiplayer football predictions
            </div>

            <h1 className="max-w-[18ch] text-4xl font-black leading-[0.92] tracking-tight text-[#111827] sm:text-5xl md:text-6xl">
              Turn every matchday into a shared competition.
            </h1>

            <p className="mt-5 max-w-[56ch] text-base leading-relaxed text-[#374151] md:text-lg">
              Piotrmacher helps friends run private betting rooms, score predictions automatically, and follow a transparent leaderboard from kickoff to final whistle.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/?login=1"
                className="inline-flex min-h-12 items-center justify-center border border-[#4CAF50] bg-[#4CAF50] px-6 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:border-[#81C784] hover:bg-[#81C784]"
              >
                Create your room
              </Link>
              <Link
                href="/?login=1"
                className="inline-flex min-h-12 items-center justify-center border border-gray-300 bg-white px-6 text-sm font-bold uppercase tracking-wide text-[#111827] transition-colors hover:border-[#4CAF50] hover:text-[#2E7D32]"
              >
                Sign in to continue
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap gap-5 text-sm text-[#4B5563]">
              <p className="font-semibold">Private rooms</p>
              <p className="font-semibold">Automated scoring</p>
              <p className="font-semibold">Clear standings</p>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -left-6 -top-6 hidden h-20 w-20 border-4 border-[#4CAF50]/35 md:block" />
            <div className="absolute -bottom-6 -right-6 hidden h-28 w-28 border-4 border-[#111827]/15 md:block" />
            <div className="relative aspect-[16/10.3] overflow-hidden">
              <Image
                src="/rooms.webp"
                alt="Piotrmacher rooms view showing active leagues"
                fill
                className="object-contain"
                priority
              />
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-zinc-200 bg-white px-4 py-10 md:px-6 md:py-14">
        <div className="mx-auto grid w-full max-w-[1320px] gap-8 md:grid-cols-3 md:gap-0">
          <article className="md:pr-8">
            <h2 className="text-lg font-black uppercase tracking-wide text-[#111827]">Pick A Competition. Bet.</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#4B5563]">
              Create a room, invite your people, and run the whole competition from kickoff to final table without extra setup.
            </p>
          </article>
          <article className="md:border-x md:border-zinc-200 md:px-8">
            <h2 className="text-lg font-black uppercase tracking-wide text-[#111827]">Built For Fair Play</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#4B5563]">
              Shared history and transparent points make the outcome understandable for every participant.
            </p>
          </article>
          <article className="md:pl-8">
            <h2 className="text-lg font-black uppercase tracking-wide text-[#111827]">Custom Scoring Rules</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#4B5563]">
              Set your own points system and shape the room exactly the way your group wants to play.
            </p>
          </article>
        </div>
      </section>

      <section className="px-4 py-12 md:px-6 md:py-16">
        <div className="mx-auto w-full max-w-[1320px]">
          <div className="mb-9 md:mb-12">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#2E7D32]">How it flows</p>
            <h2 className="mt-3 max-w-[24ch] text-3xl font-black tracking-tight text-[#111827] md:text-4xl">
              One clear journey from room creation to final leaderboard.
            </h2>
          </div>

          <div className="space-y-10 md:space-y-12">
            {flowSteps.map((screen, index) => (
              <article
                key={screen.src}
                className="grid items-center gap-5 border-t border-zinc-200 pt-8 first:border-t-0 first:pt-0 md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] md:gap-10"
              >
                <div className={index % 2 === 1 ? 'md:order-2' : ''}>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#2E7D32]">{screen.stepLabel}</p>
                  <h3 className="mt-2 text-2xl font-black leading-tight tracking-tight text-[#111827] md:text-3xl">{screen.title}</h3>
                  <p className="mt-3 max-w-[52ch] text-sm leading-relaxed text-[#4B5563] md:text-base">{screen.description}</p>
                </div>

                <div className={index % 2 === 1 ? 'md:order-1' : ''}>
                  <div className="relative aspect-[16/10.3] overflow-hidden">
                    <Image
                      src={screen.src}
                      alt={`${screen.title} screenshot from Piotrmacher`}
                      fill
                      sizes="(max-width: 767px) 100vw, 50vw"
                      className="object-contain"
                    />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pb-12 md:px-6 md:pb-20">
        <div className="mx-auto max-w-[1320px] border-t border-zinc-200 pt-8 md:pt-12">
          <div className="mx-auto flex max-w-[760px] flex-col items-center gap-5 text-center">
            <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#2E7D32]">Ready for kickoff?</p>
            <h2 className="mt-3 text-3xl font-black leading-tight tracking-tight text-[#111827] md:text-4xl">
              Start your first room and let the table decide the winner.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-[#4B5563] md:text-base">
              Invite players, lock predictions, and keep every result transparent from day one.
            </p>
            </div>
            <div>
              <Link
                href="/?login=1"
                className="inline-flex min-h-12 items-center justify-center border border-[#4CAF50] bg-[#4CAF50] px-7 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:border-[#81C784] hover:bg-[#81C784]"
              >
                Get started
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
