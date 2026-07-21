import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Mascot } from '../components/Mascot'
import { ClayEgg } from '../components/ClayEgg'
import { StatusPill } from '../components/StatusPill'
import { useDecisions } from '../lib/store'
import { nurseryCounts } from '../lib/dna'
import { twinOutcome, formatUsd, formatAmount } from '../lib/prices'
import { liveState, type Decision, type DecisionState } from '../lib/types'
import { formatDate, formatIncubation, useNow } from '../lib/time'
import './nursery.css'

type Filter = 'all' | DecisionState

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All Eggs' },
  { id: 'incubating', label: 'Incubating' },
  { id: 'ready', label: 'Ready' },
  { id: 'hatched', label: 'Hatched' },
  { id: 'shelled', label: 'Shelled' },
]

const MOODS: Record<DecisionState, string> = {
  incubating: 'Thinking…',
  ready: 'Fidgeting.',
  hatched: 'Proud.',
  shelled: 'Relieved.',
}

export function Nursery() {
  const decisions = useDecisions()
  const now = useNow(30_000)
  const [filter, setFilter] = useState<Filter>('all')

  const counts = useMemo(() => nurseryCounts(decisions), [decisions, now])

  const visible = useMemo(
    () =>
      filter === 'all'
        ? decisions
        : decisions.filter((d) => liveState(d, now) === filter),
    [decisions, filter, now],
  )

  const shelves = useMemo(() => {
    const rows: Decision[][] = []
    for (let i = 0; i < visible.length; i += 3) {
      rows.push(visible.slice(i, i + 3))
    }
    return rows
  }, [visible])

  return (
    <section className="page-shell nursery" aria-labelledby="nursery-heading">
      <header className="nursery-head">
        <div>
          <p className="eyebrow">Your incubator</p>
          <h1 id="nursery-heading">The Nursery</h1>
          <p className="nursery-sub">
            Every egg is a decision you trusted to your other half.
          </p>
        </div>
        <Link className="btn btn-yolk" to="/#composer">
          Incubate a decision
        </Link>
      </header>

      <div className="nursery-filters" role="tablist" aria-label="Filter eggs">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={filter === f.id}
            className={`chip ${filter === f.id ? 'is-selected' : ''}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
            <span className="filter-count">
              {f.id === 'all' ? counts.all : counts[f.id]}
            </span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyNursery filter={filter} />
      ) : (
        <div className="shelves">
          {shelves.map((row, r) => (
            <div key={r} className="shelf-row">
              <div className="shelf-eggs">
                {row.map((d, i) => (
                  <EggSpecimen key={d.id} decision={d} index={r * 3 + i} now={now} />
                ))}
              </div>
              <svg
                className="shelf-curve"
                viewBox="0 0 900 46"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path
                  d="M0 12 C 220 42, 680 42, 900 12 L900 30 C 680 58, 220 58, 0 30 Z"
                  fill="rgba(16, 46, 36, 0.85)"
                />
                <path
                  d="M0 12 C 220 42, 680 42, 900 12"
                  fill="none"
                  stroke="var(--cream-14)"
                  strokeWidth="2"
                />
              </svg>
            </div>
          ))}
        </div>
      )}

      <p className="nursery-whisper">
        Do not tap the eggs. They are concentrating.
      </p>
    </section>
  )
}

/* ------------------------------------------------------------------ */

function EggSpecimen({
  decision,
  index,
  now,
}: {
  decision: Decision
  index: number
  now: number
}) {
  const state = liveState(decision, now)
  const rotations = [-6, 3, -2, 5, -4, 2, 6, -3, 1]
  const rot = rotations[index % rotations.length]
  const outcome =
    state === 'hatched' || state === 'shelled'
      ? twinOutcome(decision, decision.resolvedAt)
      : null

  const eggMode =
    state === 'hatched' ? 'cracked' : state === 'ready' ? 'trembling' : 'closed'

  return (
    <Link
      to={`/egg/${decision.id}`}
      className="specimen"
      style={{ '--rot': `${rot}deg` } as React.CSSProperties}
      aria-label={`${decision.intention} ${decision.asset}, ${state}`}
    >
      <div className="specimen-egg">
        <ClayEgg mode={eggMode} size={86} />
      </div>
      <div className="specimen-info">
        <div className="specimen-title">
          <strong>
            {decision.intention} {decision.asset}
          </strong>
          <StatusPill state={state} />
        </div>
        <ul className="specimen-facts">
          <li>
            {formatAmount(decision.amount)} {decision.unit}
          </li>
          <li>Created {formatDate(decision.createdAt)}</li>
          <li>{formatIncubation(decision.incubationMs)} incubation</li>
          <li className="specimen-mood">{MOODS[state]}</li>
        </ul>
        {outcome && (
          <p className="specimen-outcome">
            {decision.resolution === 'hatched' ? 'HATCH' : 'SHELL'} vs{' '}
            {decision.resolution === 'hatched' ? 'SHELL' : 'HATCH'}:{' '}
            <strong
              className={
                (decision.resolution === 'hatched'
                  ? outcome.differenceUsd
                  : -outcome.differenceUsd) >= 0
                  ? 'won'
                  : 'lost'
              }
            >
              {(decision.resolution === 'hatched'
                ? outcome.differenceUsd
                : -outcome.differenceUsd) >= 0
                ? 'your half won by '
                : 'the other half won by '}
              {formatUsd(Math.abs(outcome.differenceUsd), true)}
            </strong>
          </p>
        )}
      </div>
    </Link>
  )
}

/* ------------------------------------------------------------------ */

const EMPTY_LINES: Record<Filter, { title: string; body: string }> = {
  all: {
    title: 'The nursery is quiet.',
    body: 'No eggs yet. Dimidium is sitting here, politely, waiting for your first almost-decision.',
  },
  incubating: {
    title: 'Nothing is incubating.',
    body: 'No thoughts in the shell right now. Suspiciously decisive of you.',
  },
  ready: {
    title: 'Nothing is ready to hatch.',
    body: 'All eggs are still thinking. Still incubating. Very mysterious.',
  },
  hatched: {
    title: 'Nothing has hatched yet.',
    body: 'When you act on an incubated decision, its shell ends up here.',
  },
  shelled: {
    title: 'Nothing returned to the shell.',
    body: 'No decisions declined yet. The shell is patient. The shell can wait.',
  },
}

function EmptyNursery({ filter }: { filter: Filter }) {
  const copy = EMPTY_LINES[filter]
  return (
    <div className="nursery-empty">
      <Mascot variant="small" />
      <h2>{copy.title}</h2>
      <p>{copy.body}</p>
      <Link className="btn btn-shell" to="/#composer">
        Give Dimidium something to think about
      </Link>
    </div>
  )
}
