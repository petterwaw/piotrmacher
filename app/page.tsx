import { createServerSupabaseClient } from '@/app/utils/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import ScoringDemo from './components/landing/ScoringDemo'
import { displayFont } from './components/landing/fonts'

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B5E20]'
const primaryAction = `inline-flex min-h-12 items-center justify-center border-2 border-[#2E7D32] bg-[#2E7D32] px-6 text-base font-bold text-white transition-colors duration-150 hover:border-[#1B5E20] hover:bg-[#1B5E20] ${focusRing}`
const secondaryAction = `inline-flex min-h-12 items-center justify-center border-2 border-zinc-300 bg-white px-6 text-base font-bold text-[#0F1A12] transition-colors duration-150 hover:border-[#2E7D32] hover:text-[#1B5E20] ${focusRing}`
const display = `${displayFont.className} font-extrabold uppercase`

const matchday = [
  {
    title: 'Make a room',
    body: 'Pick one competition, name the room and decide how many points each rule is worth. You are the host.',
  },
  {
    title: 'Send the invite code',
    body: 'Friends sign in and join with the room’s code. Nobody else can see the room or its table.',
  },
  {
    title: 'Picks lock at kickoff',
    body: 'Everyone enters an exact score for each match. Once the match starts, the pick can’t be changed.',
  },
  {
    title: 'Points arrive after the final whistle',
    body: 'Results arrive from ESPN and every pick is scored. Nobody types in results or keeps a spreadsheet.',
  },
]

const rules = [
  { rule: 'Correct winner', example: 'You say 2:1, it ends 3:0' },
  { rule: 'Correct draw', example: 'You say 1:1, it ends 2:2' },
  { rule: 'Correct goal difference', example: 'You say 2:0, it ends 3:1' },
  { rule: 'Correct goals for a team', example: 'You say 2:1, it ends 2:3' },
  { rule: 'Exact score', example: 'You say 2:1, it ends 2:1' },
  { rule: 'Exact draw', example: 'You say 1:1, it ends 1:1' },
]

const competitions = [
  'Premier League',
  'Championship',
  'La Liga',
  'Serie A',
  'Bundesliga',
  'Ligue 1',
  'Champions League',
  'Europa League',
  'Conference League',
  'Nations League',
]

export default async function Home() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect('/home')
  }

  return (
    <div className="w-full text-[#0F1A12] selection:bg-[#C8E6C9] selection:text-[#0F1A12]">
      {/* Opening: the offer on the left, the scoring working on the right. */}
      <section className="px-4 pb-16 pt-8 md:px-6 md:pb-24 md:pt-14">
        <div className="mx-auto grid w-full max-w-[1320px] gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,34rem)] lg:items-start lg:gap-16">
          <div className="lg:pt-6">
            <h1 className={`${display} text-balance text-[3.25rem] italic leading-[0.9] tracking-[-0.01em] sm:text-7xl lg:text-[5.75rem]`}>
              Call the score.
              <span className="block text-[#2E7D32]">Settle it in the table.</span>
            </h1>

            <p className="mt-6 max-w-[34rem] text-lg leading-relaxed text-[#27312B]">
              Piotrmacher is a score-prediction game for your group of friends. Open a private room for a league or a
              cup, share the invite code, and everyone predicts the exact score of each match before kickoff. After the
              final whistle the points are counted for you.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/?login=1" className={primaryAction}>
                Create a room
              </Link>
              <Link href="/?login=1" className={secondaryAction}>
                Join with an invite code
              </Link>
            </div>
            <p className="mt-3 text-sm text-[#3F4A43]">Sign in with email or Google first. Joining and hosting work the same way.</p>

            <dl className="mt-12 hidden max-w-[34rem] grid-cols-3 border-t-2 border-[#0F1A12] pt-4 text-sm lg:grid">
              <div>
                <dt className="font-bold">Competitions</dt>
                <dd className="mt-1 text-[#3F4A43]">10 leagues and cups</dd>
              </div>
              <div>
                <dt className="font-bold">Match data</dt>
                <dd className="mt-1 text-[#3F4A43]">Fixtures and results from ESPN</dd>
              </div>
              <div>
                <dt className="font-bold">Rooms</dt>
                <dd className="mt-1 text-[#3F4A43]">Private, joined by code</dd>
              </div>
            </dl>
          </div>

          <div>
            <h2 className="sr-only">Try the scoring</h2>
            <ScoringDemo />
            <p className="mt-3 text-sm text-[#3F4A43]">Example match and players. Every rule here is worth 1 point, the default a host can change.</p>
          </div>
        </div>
      </section>

      {/* A matchday, in the order it happens. */}
      <section className="border-y-2 border-zinc-300 bg-white px-4 py-16 md:px-6 md:py-24" aria-labelledby="matchday-heading">
        <div className="mx-auto w-full max-w-[1320px]">
          <h2 id="matchday-heading" className={`${display} max-w-[18ch] text-5xl leading-[0.92] md:text-6xl`}>
            How a room runs
          </h2>
          <p className="mt-4 max-w-[40rem] text-lg leading-relaxed text-[#27312B]">
            One host sets it up and starts it. From then on the room follows its competition’s fixture list, until the
            competition ends or the end date the host picked.
          </p>

          <ol className="mt-12 grid gap-0 md:grid-cols-4">
            {matchday.map((step) => (
              <li key={step.title} className="relative border-l-2 border-[#0F1A12] pb-10 pl-6 last:pb-0 md:border-l-0 md:border-t-2 md:pb-0 md:pl-0 md:pr-8 md:pt-6">
                <span
                  className="absolute -left-[7px] top-1.5 h-3 w-3 bg-[#2E7D32] md:-top-[7px] md:left-0"
                  aria-hidden="true"
                />
                <h3 className="text-xl font-bold leading-tight">{step.title}</h3>
                <p className="mt-2 max-w-[32ch] text-base leading-relaxed text-[#3F4A43]">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* The rules, in the host's hands. */}
      <section className="px-4 py-16 md:px-6 md:py-24" aria-labelledby="rules-heading">
        <div className="mx-auto grid w-full max-w-[1320px] gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
          <div>
            <h2 id="rules-heading" className={`${display} text-5xl leading-[0.92] md:text-6xl`}>
              The host sets the price of every call
            </h2>
            <p className="mt-5 max-w-[34rem] text-lg leading-relaxed text-[#27312B]">
              Every rule a pick satisfies adds its points, so one good call can pay several times. With the defaults an
              exact 2:1 is worth 5: the winner, the goal difference, both teams’ goals and the exact score.
            </p>
            <p className="mt-4 max-w-[34rem] text-base leading-relaxed text-[#3F4A43]">
              Cup matches are settled on the 90-minute score. Extra time and penalties don’t count.
            </p>
          </div>

          <div className="border-2 border-zinc-300 bg-white">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">Scoring rules with an example and default points</caption>
              <thead>
                <tr className="border-b-2 border-[#0F1A12] text-sm text-[#3F4A43]">
                  <th scope="col" className="px-4 py-3 font-bold sm:px-5">Rule</th>
                  <th scope="col" className="hidden px-4 py-3 font-bold sm:table-cell">Example</th>
                  <th scope="col" className="px-4 py-3 text-right font-bold sm:px-5">Default</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((row) => (
                  <tr key={row.rule} className="border-b border-zinc-200 last:border-b-0">
                    <th scope="row" className="px-4 py-3 align-top font-normal sm:px-5">
                      <span className="block font-bold">{row.rule}</span>
                      <span className="mt-0.5 block text-sm text-[#3F4A43] sm:hidden">{row.example}</span>
                    </th>
                    <td className="hidden px-4 py-3 align-top text-[#3F4A43] sm:table-cell">{row.example}</td>
                    <td className="px-4 py-3 text-right align-top font-bold tabular-nums sm:px-5">1 pt</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="border-t-2 border-zinc-200 bg-[#F4F7F4] px-4 py-3 text-sm text-[#3F4A43] sm:px-5">
              Room settings let the host change each value before the room starts.
            </p>
          </div>
        </div>
      </section>

      {/* Where rooms can live. */}
      <section className="bg-[#123D17] px-4 py-16 text-white md:px-6 md:py-24" aria-labelledby="competitions-heading">
        <div className="mx-auto w-full max-w-[1320px]">
          <h2 id="competitions-heading" className={`${display} text-5xl leading-[0.92] md:text-6xl`}>
            One room, one competition
          </h2>
          <ul className={`${displayFont.className} mt-8 flex flex-col gap-y-1 text-[2rem] font-semibold uppercase italic leading-[1.05] text-[#C8E6C9] sm:flex-row sm:flex-wrap sm:gap-x-4 sm:text-5xl`}>
            {competitions.map((name, index) => (
              <li key={name} className="flex items-baseline gap-4">
                {name}
                {index < competitions.length - 1 ? (
                  <span className="hidden text-[#4CAF50] sm:inline" aria-hidden="true">/</span>
                ) : null}
              </li>
            ))}
          </ul>

          <div className="mt-14 grid gap-8 border-t border-white/25 pt-8 md:grid-cols-2 md:gap-16">
            <p className="max-w-[36rem] text-lg leading-relaxed text-[#E8F5E9]">
              Fixtures, kickoff times and final scores come from ESPN, so the room always shows the real schedule. When a
              competition ends, its rooms close on the final table.
            </p>
            <div className="max-w-[36rem]">
              <h3 className="text-lg font-bold text-white">World Cup rooms add a pick’em</h3>
              <p className="mt-2 text-base leading-relaxed text-[#C8E6C9]">
                Before the first match, rank every group from first to last. Each team you put in its final position
                scores, on top of the match predictions.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Close. */}
      <section className="px-4 py-16 md:px-6 md:py-24" aria-labelledby="start-heading">
        <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-8 border-2 border-[#0F1A12] bg-white px-5 py-10 md:flex-row md:items-end md:justify-between md:px-10 md:py-12">
          <div>
            <h2 id="start-heading" className={`${display} text-balance text-5xl italic leading-[0.92] md:text-7xl`}>
              Start a room before the next matchday
            </h2>
            <p className="mt-4 max-w-[36rem] text-lg leading-relaxed text-[#27312B]">
              It takes a name and a competition. Send the code to the group chat and the first predictions can go in today.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-3 sm:flex-row md:flex-col lg:flex-row">
            <Link href="/?login=1" className={primaryAction}>
              Create a room
            </Link>
            <Link href="/?login=1" className={secondaryAction}>
              Sign in
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
