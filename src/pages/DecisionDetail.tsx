import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Mascot } from '../components/Mascot'
import { ClayEgg } from '../components/ClayEgg'
import { StatusPill } from '../components/StatusPill'
import { useDecision, decisionStore } from '../lib/store'
import { formatUsd, formatAmount, twinOutcome, pricePath } from '../lib/prices'
import { liveState, type Decision } from '../lib/types'
import {
  formatDate,
  formatDuration,
  formatIncubation,
  useNow,
  usePrefersReducedMotion,
} from '../lib/time'
import { stateLine } from '../lib/microcopy'
import './detail.css'

export function DecisionDetail() {
  const { id } = useParams()
  const decision = useDecision(id)

  if (!decision) {
    return (
      <section className="page-shell detail-missing">
        <Mascot variant="small" />
        <h1>This egg wandered off.</h1>
        <p>
          We looked everywhere in the nursery. It may have been from another
          browser, or another timeline entirely.
        </p>
        <Link className="btn btn-shell" to="/nursery">
          Back to the Nursery
        </Link>
      </section>
    )
  }

  return <DetailBody decision={decision} />
}

/* ------------------------------------------------------------------ */

type FxState = 'none' | 'hatching' | 'shelling' | 'stretching'

function DetailBody({ decision }: { decision: Decision }) {
  const now = useNow(1000)
  const reducedMotion = usePrefersReducedMotion()
  const [fx, setFx] = useState<FxState>('none')
  const [flash, setFlash] = useState<string | null>(null)

  const state = liveState(decision, now)
  const outcome = useMemo(
    () => twinOutcome(decision, decision.resolvedAt ?? now),
    // Recompute at second granularity via `now`.
    [decision, now],
  )
  const remaining = decision.hatchesAt - now

  const runFx = (kind: FxState, message: string, after: () => void) => {
    if (reducedMotion) {
      after()
      setFlash(message)
      setTimeout(() => setFlash(null), 3000)
      return
    }
    setFx(kind)
    setTimeout(() => {
      after()
      setFx('none')
      setFlash(message)
      setTimeout(() => setFlash(null), 3200)
    }, kind === 'stretching' ? 550 : 1100)
  }

  const hatch = () =>
    runFx('hatching', 'It hatched. Deep breath.', () =>
      decisionStore.resolve(decision.id, 'hatched'),
    )
  const shell = () =>
    runFx('shelling', 'The shell supports this decision.', () =>
      decisionStore.resolve(decision.id, 'shelled'),
    )
  const moreTime = () =>
    runFx('stretching', 'Still incubating. Very mysterious.', () =>
      decisionStore.extend(decision.id, decision.incubationMs),
    )

  const eggMode =
    state === 'hatched' ? 'cracked' : state === 'ready' ? 'trembling' : 'closed'

  const confetti = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => ({
        dx: Math.cos((i / 16) * Math.PI * 2) * (60 + (i % 4) * 26),
        dy: Math.sin((i / 16) * Math.PI * 2) * (46 + ((i + 2) % 4) * 22) - 40,
        rot: (i * 47) % 360,
        color: i % 3 === 0 ? 'var(--yolk)' : i % 3 === 1 ? 'var(--cream)' : 'var(--coral)',
        delay: (i % 5) * 0.04,
      })),
    [],
  )

  return (
    <section className="page-shell detail" aria-labelledby="detail-heading">
      <div className="detail-top">
        <div className={`detail-egg fx-${fx}`}>
          <ClayEgg mode={eggMode} size={150} />
          {fx === 'hatching' &&
            confetti.map((c, i) => (
              <span
                key={i}
                className="confetti"
                aria-hidden="true"
                style={
                  {
                    '--dx': `${c.dx}px`,
                    '--dy': `${c.dy}px`,
                    '--rot': `${c.rot}deg`,
                    background: c.color,
                    animationDelay: `${c.delay}s`,
                  } as React.CSSProperties
                }
              />
            ))}
          {fx === 'shelling' && (
            <div className="relieved-mascot" aria-hidden="true">
              <Mascot variant="small" />
            </div>
          )}
        </div>

        <div className="detail-summary">
          <StatusPill state={state} />
          <h1 id="detail-heading" className="detail-heading">
            {decision.intention} {formatAmount(decision.amount)}{' '}
            {decision.unit === decision.asset
              ? decision.asset
              : `${decision.unit} of ${decision.asset}`}
          </h1>
          <p className="detail-mood">{stateLine(state, decision.seed)}</p>

          {state === 'incubating' && (
            <p className="countdown" role="timer" aria-label="Time until this decision is ready">
              <span className="countdown-num">{formatDuration(remaining)}</span>
              <span className="countdown-label">until it can hatch</span>
            </p>
          )}
          {state === 'ready' && (
            <p className="countdown">
              <span className="countdown-num">Ready.</span>
              <span className="countdown-label">
                The timer ended. The decision is yours again.
              </span>
            </p>
          )}
          {decision.resolvedAt && (
            <p className="countdown-label">
              Resolved {formatDate(decision.resolvedAt)} ·{' '}
              {decision.resolution === 'hatched'
                ? 'you acted'
                : 'you chose not to chase it'}
            </p>
          )}

          <dl className="detail-facts">
            <div>
              <dt>Created</dt>
              <dd>{formatDate(decision.createdAt)}</dd>
            </div>
            <div>
              <dt>Incubation</dt>
              <dd>
                {formatIncubation(decision.incubationMs)}
                {decision.extensions > 0 &&
                  ` (+${decision.extensions} extension${decision.extensions === 1 ? '' : 's'})`}
              </dd>
            </div>
            <div>
              <dt>Entry price</dt>
              <dd>{formatUsd(decision.entryPrice)}</dd>
            </div>
            <div>
              <dt>Privacy</dt>
              <dd>
                {decision.privacy === 'private'
                  ? 'Private commitment'
                  : 'Public experiment'}
              </dd>
            </div>
          </dl>

          {decision.note && (
            <blockquote className="detail-note">
              <span className="detail-note-label">Your note to future you</span>
              “{decision.note}”
            </blockquote>
          )}
        </div>
      </div>

      <TwinPaths decision={decision} nowValue={outcome} />

      <div className="detail-actions">
        {(state === 'incubating' || state === 'ready') && (
          <>
            <button type="button" className="btn btn-yolk" onClick={hatch} disabled={fx !== 'none'}>
              Hatch this decision
            </button>
            <button type="button" className="btn btn-shell" onClick={shell} disabled={fx !== 'none'}>
              Return it to the shell
            </button>
            <button type="button" className="btn btn-ghost" onClick={moreTime} disabled={fx !== 'none'}>
              Give me more time
            </button>
          </>
        )}
        {state === 'hatched' && (
          <p className="detail-resolved-line">
            Hatched. Past you has left future you a note — and future you just
            read it.
          </p>
        )}
        {state === 'shelled' && (
          <div className="detail-resolved-wrap">
            <p className="detail-resolved-line">
              You chose not to chase it. The shell supports this decision.
            </p>
            <RegretReceipt decision={decision} outcome={outcome} />
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={moreTime}
              disabled={fx !== 'none'}
            >
              Actually… incubate it again
            </button>
          </div>
        )}
      </div>

      {flash && (
        <div className="detail-flash" role="status">
          {flash}
        </div>
      )}

      <div className="detail-footer-links">
        <Link to="/nursery">← Back to the Nursery</Link>
        <span className="sim-note">Simulated testnet data</span>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */

const RECEIPT_VERBS: Record<Decision['intention'], string> = {
  Buy: 'bought',
  Sell: 'sold',
  Swap: 'swapped',
  Transfer: 'transferred',
}

/**
 * The regret receipt: a shareable memento printed whenever a decision is
 * returned to the shell. Signed by the half of you that waits.
 */
function RegretReceipt({
  decision,
  outcome,
}: {
  decision: Decision
  outcome: ReturnType<typeof twinOutcome>
}) {
  const [copied, setCopied] = useState(false)

  const thing =
    decision.asset === 'ETH'
      ? `${formatAmount(decision.amount)} ETH`
      : `${formatAmount(decision.amount)} shares of ${decision.asset}`
  // differenceUsd = acting − waiting; shelling means you kept the waiting side
  const saved = outcome.differenceUsd <= 0
  const amountUsd = formatUsd(Math.abs(outcome.differenceUsd), true)
  const caption = `I almost ${RECEIPT_VERBS[decision.intention]} ${thing}. I didn't. I ${
    saved ? 'saved' : 'lost'
  } ${amountUsd}. — signed, my other half`

  const shareOnX = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
      `${caption}\n\n🥚 Dimidium — meet the half of you that waits`,
    )}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const copyCaption = async () => {
    try {
      await navigator.clipboard.writeText(caption)
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="receipt-wrap">
      <article className="receipt" aria-label="Regret receipt">
        <header className="receipt-head">
          <span>Dimidium</span>
          <span>Receipt of restraint</span>
        </header>
        <dl className="receipt-rows">
          <div>
            <dt>Almost</dt>
            <dd>
              {RECEIPT_VERBS[decision.intention]} {thing}
            </dd>
          </div>
          <div>
            <dt>Instead</dt>
            <dd>nothing, on purpose</dd>
          </div>
          <div>
            <dt>Resolved</dt>
            <dd>{formatDate(decision.resolvedAt ?? decision.hatchesAt)}</dd>
          </div>
          <div className="receipt-outcome">
            <dt>{saved ? 'You saved' : 'You lost'}</dt>
            <dd className={saved ? 'is-saved' : 'is-lost'}>{amountUsd}</dd>
          </div>
        </dl>
        <p className="receipt-caption">“{caption}”</p>
        <p className="receipt-fine">
          Simulated testnet data · no eggs were traded
        </p>
      </article>
      <div className="receipt-actions">
        <button type="button" className="btn btn-shell btn-sm" onClick={shareOnX}>
          Share on X
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={copyCaption}>
          {copied ? 'Copied.' : 'Copy caption'}
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */

interface TwinProps {
  decision: Decision
  nowValue: ReturnType<typeof twinOutcome>
}

function buildSeries(decision: Decision, points: number[]) {
  const notional = decision.amount * decision.entryPrice
  const actWinsWhenUp =
    decision.intention === 'Buy' || decision.intention === 'Swap'
  const hatch = points.map((p) =>
    actWinsWhenUp ? decision.amount * p : notional,
  )
  const shellSeries = points.map((p) =>
    actWinsWhenUp ? notional : decision.amount * p,
  )
  return { hatch, shell: shellSeries }
}

function isFlat(values: number[]): boolean {
  return Math.max(...values) - Math.min(...values) < 1e-9
}

function toPath(values: number[], w: number, h: number, pad = 10): string {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const step = (w - pad * 2) / Math.max(values.length - 1, 1)
  return values
    .map((v, i) => {
      const x = pad + i * step
      const y = h - pad - ((v - min) / span) * (h - pad * 2)
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
}

function TwinPaths({ decision, nowValue }: TwinProps) {
  const fullPath = pricePath(decision.asset, decision.seed, decision.entryPrice)
  const observed = nowValue.path.length
  const points = fullPath.slice(0, Math.max(observed, 2))
  const { hatch, shell } = buildSeries(decision, points)
  const diff = nowValue.differenceUsd
  const leadingHalf = diff > 0 ? 'hatch' : diff < 0 ? 'shell' : 'tie'

  const W = 320
  const H = 130

  return (
    <div className="twin" aria-label="The two possible timelines">
      <svg
        className="twin-split"
        viewBox="0 0 600 120"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M300 6 C 300 45, 230 55, 140 100"
          fill="none"
          stroke="var(--yolk)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray="1 12"
        />
        <path
          d="M300 6 C 300 45, 370 55, 460 100"
          fill="none"
          stroke="var(--sage)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray="1 12"
        />
      </svg>

      <div className="twin-cols">
        <article className={`twin-path twin-hatch ${leadingHalf === 'hatch' ? 'is-leading' : ''}`}>
          <header>
            <span className="twin-tag">Hatch</span>
            <h2>What if I acted?</h2>
          </header>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="twin-chart"
            role="img"
            aria-label={`Simulated value if acted: ${formatUsd(nowValue.hatchValue)}`}
          >
            <line x1="10" y1={H - 10} x2={W - 10} y2={H - 10} className="twin-grid" />
            <line x1="10" y1={H / 2} x2={W - 10} y2={H / 2} className="twin-grid twin-grid-faint" />
            <path d={toPath(points, W, H)} className="twin-line-ghost" />
            <path
              d={
                isFlat(hatch)
                  ? `M 10 ${H / 2} L ${W - 10} ${H / 2}`
                  : toPath(hatch, W, H)
              }
              className="twin-line twin-line-hatch"
            />
          </svg>
          <p className="twin-value">{formatUsd(nowValue.hatchValue)}</p>
          <p className="twin-caption">
            If the {decision.intention.toLowerCase()} had executed at{' '}
            {formatUsd(decision.entryPrice)}.
          </p>
        </article>

        <div className="twin-diff" role="status">
          <span className="twin-diff-label">Estimated difference</span>
          <span
            className={`twin-diff-num ${diff >= 0 ? 'is-hatch' : 'is-shell'}`}
          >
            {diff >= 0 ? '+' : '−'}
            {formatUsd(Math.abs(diff), true)}
          </span>
          <span className="twin-diff-half">
            {leadingHalf === 'tie'
              ? 'Perfectly balanced so far'
              : leadingHalf === 'hatch'
                ? 'Acting is ahead — for now'
                : 'Waiting is ahead — for now'}
          </span>
        </div>

        <article className={`twin-path twin-shell ${leadingHalf === 'shell' ? 'is-leading' : ''}`}>
          <header>
            <span className="twin-tag">Shell</span>
            <h2>What if I waited?</h2>
          </header>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="twin-chart"
            role="img"
            aria-label={`Simulated value if waited: ${formatUsd(nowValue.shellValue)}`}
          >
            <line x1="10" y1={H - 10} x2={W - 10} y2={H - 10} className="twin-grid" />
            <line x1="10" y1={H / 2} x2={W - 10} y2={H / 2} className="twin-grid twin-grid-faint" />
            <path d={toPath(points, W, H)} className="twin-line-ghost" />
            <path
              d={
                isFlat(shell)
                  ? `M 10 ${H / 2} L ${W - 10} ${H / 2}`
                  : toPath(shell, W, H)
              }
              className="twin-line twin-line-shell"
            />
          </svg>
          <p className="twin-value">{formatUsd(nowValue.shellValue)}</p>
          <p className="twin-caption">
            {decision.intention === 'Buy' || decision.intention === 'Swap'
              ? 'If the money simply stayed where it was.'
              : 'If you kept holding through the move.'}
          </p>
        </article>
      </div>
    </div>
  )
}
