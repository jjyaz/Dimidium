import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mascot } from '../components/Mascot'
import { ClayEgg } from '../components/ClayEgg'
import { decisionStore } from '../lib/store'
import { getCachedSpotPrice, formatUsd } from '../lib/prices'
import {
  ASSETS,
  INCUBATION_PRESETS,
  INTENTIONS,
  type Asset,
  type Intention,
  type Privacy,
} from '../lib/types'
import { usePrefersReducedMotion } from '../lib/time'
import './home.css'

export function Home() {
  return (
    <>
      <Hero />
      <Story />
      <Composer />
    </>
  )
}

/* ------------------------------------------------------------------ */

function Hero() {
  return (
    <section className="hero page-shell" aria-labelledby="hero-heading">
      <div className="hero-copy">
        <p className="eyebrow">An onchain companion for your other half</p>
        <h1 id="hero-heading" className="hero-heading">
          Meet the half of&nbsp;you that <em>waits.</em>
        </h1>
        <p className="hero-sub">
          Put a decision in the shell, give it a little time, and discover
          whether it deserves to hatch.
        </p>
        <div className="hero-ctas">
          <a className="btn btn-yolk" href="#composer">
            Incubate a decision
          </a>
          <Link className="btn btn-ghost" to="/how-it-works">
            See how it works
          </Link>
        </div>

        <span className="hero-tag hero-tag-a">Proof of second thought</span>
        <span className="hero-tag hero-tag-b">No token. No pressure.</span>
        <span className="hero-tag hero-tag-c">Testnet playground</span>
      </div>

      <div className="hero-mascot">
        <Mascot variant="hero" />
      </div>

      <a className="scroll-shard" href="#story" aria-label="Scroll to the story">
        <svg viewBox="0 0 48 30" width="44" height="28" aria-hidden="true">
          <path
            d="M4 4 C10 24, 38 24, 44 4 L40 8 C34 22, 14 22, 8 8 Z"
            fill="var(--cream)"
          />
        </svg>
      </a>
    </section>
  )
}

/* ------------------------------------------------------------------ */

const STAGES = [
  {
    n: '01',
    title: 'Put it in the shell',
    body: 'Record an intention before impulse rewrites the story.',
    egg: 'closed' as const,
  },
  {
    n: '02',
    title: 'Let it incubate',
    body: 'Watch the action and the alternative unfold side by side.',
    egg: 'trembling' as const,
  },
  {
    n: '03',
    title: 'Choose your half',
    body: 'Hatch, cancel, or give your future self more time.',
    egg: 'cracked' as const,
  },
]

function Story() {
  return (
    <section id="story" className="story page-shell" aria-labelledby="story-heading">
      <h2 id="story-heading" className="story-big">
        Blockchains remember what you&nbsp;did.
      </h2>
      <p className="story-offset">
        Dimidium remembers what you{' '}
        <span className="nearly">
          nearly
          <svg
            className="nearly-underline"
            viewBox="0 0 120 14"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              d="M3 9 C 25 3, 48 12, 70 7 S 108 4, 117 8"
              fill="none"
              stroke="var(--yolk)"
              strokeWidth="5"
              strokeLinecap="round"
            />
          </svg>
        </span>{' '}
        did.
      </p>

      <div className="stages">
        <svg
          className="incubation-path"
          viewBox="0 0 1000 620"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            d="M150 90 C 420 30, 700 130, 830 240 C 940 340, 620 380, 400 400 C 220 418, 140 480, 520 560"
            fill="none"
            stroke="var(--cream-38)"
            strokeWidth="3"
            strokeDasharray="2 14"
            strokeLinecap="round"
          />
        </svg>

        {STAGES.map((s, i) => (
          <article key={s.n} className={`stage stage-${i + 1}`}>
            <ClayEgg mode={s.egg} size={i === 2 ? 92 : 84} />
            <div>
              <span className="stage-n" aria-hidden="true">
                {s.n}
              </span>
              <h3 className="stage-title">{s.title}</h3>
              <p className="stage-body">{s.body}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */

type ComposerPhase = 'idle' | 'collapsing' | 'done'

const CUSTOM_MS_PER_HOUR = 60 * 60 * 1000

export function Composer() {
  const navigate = useNavigate()
  const reducedMotion = usePrefersReducedMotion()
  const [asset, setAsset] = useState<Asset>('ETH')
  const [intention, setIntention] = useState<Intention>('Buy')
  const [amount, setAmount] = useState('')
  const [periodIdx, setPeriodIdx] = useState(1)
  const [customHours, setCustomHours] = useState('48')
  const [note, setNote] = useState('')
  const [privacy, setPrivacy] = useState<Privacy>('private')
  const [error, setError] = useState<string | null>(null)
  const [phase, setPhase] = useState<ComposerPhase>('idle')
  const eggWrapRef = useRef<HTMLDivElement>(null)

  const isCustom = periodIdx === INCUBATION_PRESETS.length

  const incubationMs = isCustom
    ? Math.max(1, Number(customHours) || 0) * CUSTOM_MS_PER_HOUR
    : INCUBATION_PRESETS[periodIdx].ms

  const amountNum = Number(amount)
  const unit = asset === 'ETH' ? 'ETH' : 'shares'

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (phase !== 'idle') return

    if (!amount.trim() || Number.isNaN(amountNum) || amountNum <= 0) {
      setError('Give the egg a real amount. It can tell.')
      return
    }
    if (isCustom && (!customHours.trim() || Number(customHours) <= 0)) {
      setError('Custom incubation needs at least one hour.')
      return
    }
    setError(null)

    const finish = () => {
      const decision = decisionStore.create({
        asset,
        intention,
        amount: amountNum,
        note: note.trim(),
        privacy,
        incubationMs,
      })
      setPhase('done')
      setTimeout(() => navigate(`/egg/${decision.id}`), 1500)
    }

    if (reducedMotion) {
      finish()
    } else {
      setPhase('collapsing')
      setTimeout(finish, 950)
    }
  }

  return (
    <section id="composer" className="composer page-shell" aria-labelledby="composer-heading">
      <div className="composer-head">
        <p className="eyebrow">Interactive demo</p>
        <h2 id="composer-heading">Give Dimidium something to think about.</h2>
        <span className="sim-note">
          Simulated testnet data — no real trade occurs
        </span>
      </div>

      <form className="lab-tray" onSubmit={submit} noValidate>
        <div className="lab-cell lab-asset">
          <span className="lab-label" id="asset-label">
            Asset
          </span>
          <div className="chip-row" role="radiogroup" aria-labelledby="asset-label">
            {ASSETS.map((a) => (
              <button
                key={a}
                type="button"
                role="radio"
                aria-checked={asset === a}
                className={`chip ${asset === a ? 'is-selected' : ''}`}
                onClick={() => setAsset(a)}
              >
                {a}
              </button>
            ))}
          </div>
          <span className="lab-hint">
            Demo price: {formatUsd(getCachedSpotPrice(asset).price)}
          </span>
        </div>

        <div className="lab-cell lab-intention">
          <span className="lab-label" id="intent-label">
            Intention
          </span>
          <div className="chip-row" role="radiogroup" aria-labelledby="intent-label">
            {INTENTIONS.map((i) => (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={intention === i}
                className={`chip ${intention === i ? 'is-selected' : ''}`}
                onClick={() => setIntention(i)}
              >
                {i}
              </button>
            ))}
          </div>
        </div>

        <div className="lab-center" ref={eggWrapRef}>
          <div
            className={`lab-egg ${phase === 'collapsing' ? 'is-absorbing' : ''} ${
              phase === 'done' ? 'is-happy' : ''
            }`}
          >
            <ClayEgg mode={phase === 'done' ? 'trembling' : 'closed'} size={128} />
            {phase === 'collapsing' && !reducedMotion && (
              <div className="absorb-cloud" aria-hidden="true">
                <span style={{ '--dx': '-120px', '--dy': '-70px' } as React.CSSProperties}>
                  {intention} {asset}
                </span>
                <span style={{ '--dx': '130px', '--dy': '-40px' } as React.CSSProperties}>
                  {amount} {unit}
                </span>
                <span style={{ '--dx': '-100px', '--dy': '60px' } as React.CSSProperties}>
                  {isCustom
                    ? `${customHours}h`
                    : INCUBATION_PRESETS[periodIdx].label}
                </span>
                <span style={{ '--dx': '110px', '--dy': '75px' } as React.CSSProperties}>
                  {privacy === 'private' ? 'private' : 'public'}
                </span>
              </div>
            )}
          </div>
          {phase === 'done' ? (
            <p className="lab-success" role="status">
              Your other half is thinking.
            </p>
          ) : (
            <p className="lab-caption">Do not tap the egg. It is concentrating.</p>
          )}
        </div>

        <div className="lab-cell lab-amount">
          <label className="lab-label" htmlFor="amount">
            Amount
          </label>
          <div className="amount-wrap">
            <input
              id="amount"
              className="lab-input"
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              placeholder="0.5"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              aria-describedby={error ? 'composer-error' : undefined}
            />
            <span className="amount-unit">{unit}</span>
          </div>
          {amountNum > 0 && !Number.isNaN(amountNum) && (
            <span className="lab-hint">
              ≈ {formatUsd(amountNum * getCachedSpotPrice(asset).price)} simulated
            </span>
          )}
        </div>

        <div className="lab-cell lab-period">
          <span className="lab-label" id="period-label">
            Incubation period
          </span>
          <div className="chip-row" role="radiogroup" aria-labelledby="period-label">
            {INCUBATION_PRESETS.map((p, i) => (
              <button
                key={p.label}
                type="button"
                role="radio"
                aria-checked={periodIdx === i}
                className={`chip ${periodIdx === i ? 'is-selected' : ''}`}
                onClick={() => setPeriodIdx(i)}
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              role="radio"
              aria-checked={isCustom}
              className={`chip ${isCustom ? 'is-selected' : ''}`}
              onClick={() => setPeriodIdx(INCUBATION_PRESETS.length)}
            >
              Custom
            </button>
          </div>
          {isCustom && (
            <div className="amount-wrap custom-hours">
              <label className="visually-hidden" htmlFor="custom-hours">
                Custom incubation in hours
              </label>
              <input
                id="custom-hours"
                className="lab-input"
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                value={customHours}
                onChange={(e) => setCustomHours(e.target.value)}
              />
              <span className="amount-unit">hours</span>
            </div>
          )}
        </div>

        <div className="lab-cell lab-note">
          <label className="lab-label" htmlFor="note">
            Private note
          </label>
          <textarea
            id="note"
            className="lab-input lab-textarea"
            placeholder="Why are you considering this?"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <span className="lab-hint">Past you has left future you a note.</span>
        </div>

        <div className="lab-cell lab-privacy">
          <span className="lab-label" id="privacy-label">
            Privacy
          </span>
          <div className="chip-row" role="radiogroup" aria-labelledby="privacy-label">
            <button
              type="button"
              role="radio"
              aria-checked={privacy === 'private'}
              className={`chip ${privacy === 'private' ? 'is-selected' : ''}`}
              onClick={() => setPrivacy('private')}
            >
              Private commitment
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={privacy === 'public'}
              className={`chip ${privacy === 'public' ? 'is-selected' : ''}`}
              onClick={() => setPrivacy('public')}
            >
              Public experiment
            </button>
          </div>
        </div>

        <div className="lab-submit">
          {error && (
            <p id="composer-error" className="lab-error" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            className="btn btn-yolk"
            disabled={phase !== 'idle'}
          >
            {phase === 'idle'
              ? 'Put it in the shell'
              : phase === 'collapsing'
                ? 'Sealing…'
                : 'Sealed'}
          </button>
        </div>
      </form>
    </section>
  )
}
