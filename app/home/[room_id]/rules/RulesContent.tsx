import Breakdown from './Breakdown'
import ScoreTester from './ScoreTester'
import { pointsBreakdown, rulePoints, type MatchRules } from './points'

export type RoomRules = MatchRules & {
  pickem_correct_position: number
}

function pts(value: number) {
  return `${value} ${value === 1 ? 'pt' : 'pts'}`
}

const EXAMPLES = [
  { pick: [2, 1], final: [3, 2] },
  { pick: [1, 1], final: [1, 1] },
] as const

const SECTION = 'px-4 py-6 sm:px-6'
const H2 = 'text-lg font-black tracking-tight text-text-main'

export default function RulesContent({ rules, showPickem }: { rules: RoomRules; showPickem: boolean }) {
  const value = (key: keyof MatchRules) => rulePoints(rules, key)
  const pickemParsed = Number(rules.pickem_correct_position)
  const pickemPoints = Number.isFinite(pickemParsed) && pickemParsed >= 0 ? Math.floor(pickemParsed) : 0
  const sameTeamGoals = value('correct_home_goals') === value('correct_away_goals')

  const rows: Array<{ label: string; explain: string; points: string }> = [
    {
      label: 'Correct winner',
      explain: 'You picked the team that won.',
      points: pts(value('correct_winner')),
    },
    {
      label: 'Correct draw',
      explain: 'You picked a draw and it ended level, whatever the score.',
      points: pts(value('correct_draw')),
    },
    {
      label: 'Goal difference',
      explain: 'Same margin as the final score, like 2:0 for a 3:1. Draws have a margin of 0.',
      points: pts(value('correct_difference')),
    },
    ...(sameTeamGoals
      ? [
          {
            label: 'Team goals',
            explain: 'Right number of goals for a team, even if the result is wrong. Home and away count separately.',
            points: `${pts(value('correct_home_goals'))} each`,
          },
        ]
      : [
          {
            label: 'Home goals',
            explain: 'Right number of goals for the home team, even if the result is wrong.',
            points: pts(value('correct_home_goals')),
          },
          {
            label: 'Away goals',
            explain: 'Right number of goals for the away team, even if the result is wrong.',
            points: pts(value('correct_away_goals')),
          },
        ]),
    {
      label: 'Exact score',
      explain: 'Bonus for nailing the score of a match that had a winner.',
      points: pts(value('exact_score')),
    },
    {
      label: 'Exact draw',
      explain: 'Bonus for nailing the score of a draw.',
      points: pts(value('exact_draw')),
    },
  ]

  const perfectScore = pointsBreakdown(2, 1, 2, 1, rules).total
  const perfectDraw = pointsBreakdown(1, 1, 1, 1, rules).total

  return (
    <div className="divide-y-2 divide-zinc-200 border-2 border-zinc-300 bg-white">
      <section className={SECTION} aria-labelledby="rules-points">
        <h1 id="rules-points" className="text-xl font-black tracking-tight text-text-main sm:text-2xl">
          How scoring works
        </h1>
        <p className="mt-2 max-w-prose text-[15px] leading-relaxed text-zinc-700">
          Predict the score of each match. Every rule your pick matches adds points, so a near miss still
          earns something and an exact score collects everything below.
        </p>

        <dl className="mt-5 divide-y divide-zinc-200 border-y-2 border-zinc-200">
          {rows.map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-4 py-3">
              <div className="min-w-0">
                <dt className="text-[15px] font-bold text-text-main">{row.label}</dt>
                <dd className="mt-0.5 text-sm leading-snug text-zinc-600">{row.explain}</dd>
              </div>
              <dd className="shrink-0 whitespace-nowrap text-right text-[15px] font-bold tabular-nums text-brand">
                {row.points}
              </dd>
            </div>
          ))}
        </dl>

        <p className="mt-4 text-sm leading-relaxed text-zinc-700">
          A perfect pick in this room is worth{' '}
          <strong className="font-bold tabular-nums text-text-main">{pts(perfectScore)}</strong> (e.g. 2:1 for 2:1), or{' '}
          <strong className="font-bold tabular-nums text-text-main">{pts(perfectDraw)}</strong> for an exact draw.
        </p>
      </section>

      <section className={SECTION} aria-labelledby="rules-examples">
        <h2 id="rules-examples" className={H2}>
          Two examples
        </h2>
        <div className="mt-4 space-y-6">
          {EXAMPLES.map(({ pick, final }) => {
            const result = pointsBreakdown(pick[0], pick[1], final[0], final[1], rules)
            return (
              <div key={`${pick.join(':')}-${final.join(':')}`}>
                <p className="mb-1 text-[15px] text-text-main">
                  You pick <strong className="font-black tabular-nums">{pick[0]}:{pick[1]}</strong>, the match ends{' '}
                  <strong className="font-black tabular-nums">{final[0]}:{final[1]}</strong>
                </p>
                <Breakdown lines={result.lines} total={result.total} />
              </div>
            )
          })}
        </div>
      </section>

      <section className={SECTION} aria-labelledby="rules-timing">
        <h2 id="rules-timing" className={H2}>
          Good to know
        </h2>
        <ul className="mt-3 space-y-3 text-sm leading-relaxed text-zinc-700">
          <li>
            <strong className="font-bold text-text-main">Picks lock at kickoff.</strong> Change your pick as often as you
            like until the match starts.
          </li>
          <li>
            <strong className="font-bold text-text-main">Everyone&apos;s picks show at kickoff.</strong> Until then, nobody
            can see what you picked.
          </li>
          <li>
            <strong className="font-bold text-text-main">Only the 90 minutes count.</strong> The score after regular time
            and stoppage time is final for betting. Extra time and penalties are ignored, so a cup tie that is 1:1 after
            90 minutes is scored as a 1:1 draw.
          </li>
          <li>
            <strong className="font-bold text-text-main">Room dates matter.</strong> Matches that kicked off before the room
            was created, or after its end date, don&apos;t count.
          </li>
          <li>
            <strong className="font-bold text-text-main">Scoring is automatic.</strong> Points and standings update once a
            match is finished.
          </li>
        </ul>
      </section>

      {showPickem ? (
        <section className={SECTION} aria-labelledby="rules-pickem">
          <h2 id="rules-pickem" className={H2}>
            World Cup Pickem
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-700">
            Put every group in the order you think it will finish. Pickem locks when the first match of the tournament
            kicks off. After the whole group stage is played, you get{' '}
            <strong className="font-bold tabular-nums text-brand">{pts(pickemPoints)}</strong> for each team you placed in
            its exact final position.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-700">
            Example: if 2 of the 4 teams in a group finish exactly where you put them, that group earns you{' '}
            <strong className="font-bold tabular-nums text-text-main">{pts(2 * pickemPoints)}</strong>.
          </p>
        </section>
      ) : null}

      <section className={SECTION} aria-labelledby="rules-tester">
        <h2 id="rules-tester" className={H2}>
          Try a score
        </h2>
        <p className="mb-4 mt-1 text-sm text-zinc-700">Set a pick and a final score to see what it would earn here.</p>
        <ScoreTester rules={rules} />
      </section>
    </div>
  )
}
