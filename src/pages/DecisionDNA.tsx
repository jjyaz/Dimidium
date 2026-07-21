import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDecisions } from '../lib/store'
import { computeTraits, FRAGMENTS, type Trait } from '../lib/dna'
import { Mascot } from '../components/Mascot'
import './dna.css'

export function DecisionDNA() {
  const decisions = useDecisions()
  const traits = useMemo(() => computeTraits(decisions), [decisions])
  const [active, setActive] = useState<string | null>(null)

  const earnedFragments = useMemo(
    () => FRAGMENTS.map((f) => ({ ...f, isEarned: f.earned(decisions) })),
    [decisions],
  )
  const earnedCount = earnedFragments.filter((f) => f.isEarned).length

  const activeTrait = traits.find((t) => t.id === active) ?? null

  return (
    <section className="page-shell dna" aria-labelledby="dna-heading">
      <header className="dna-head">
        <p className="eyebrow">Your portrait</p>
        <h1 id="dna-heading">Decision DNA</h1>
        <p className="dna-disclaimer">
          This is not a credit score, investment score, or measure of how much
          money you made. It is a portrait of how you make decisions.
        </p>
      </header>

      {decisions.length === 0 ? (
        <div className="dna-empty">
          <Mascot variant="small" />
          <h2>No DNA to read yet.</h2>
          <p>
            Your portrait grows out of your eggs. Incubate a first decision and
            Dimidium will start sketching.
          </p>
          <Link className="btn btn-shell" to="/#composer">
            Incubate a decision
          </Link>
        </div>
      ) : (
        <>
          <div className="dna-lab">
            <div className="dna-yolk-wrap">
              <YolkFlower traits={traits} active={active} onSelect={setActive} />
              <p className="dna-yolk-caption" role="status">
                {activeTrait ? (
                  <>
                    <strong>{activeTrait.name}</strong> — {activeTrait.line}
                  </>
                ) : (
                  'Touch a lobe to read it.'
                )}
              </p>
            </div>

            <ul className="dna-traits">
              {traits.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    className={`dna-trait ${active === t.id ? 'is-active' : ''}`}
                    onClick={() => setActive(active === t.id ? null : t.id)}
                    aria-pressed={active === t.id}
                  >
                    <span className="dna-trait-name">{t.name}</span>
                    <span className="dna-trait-bar" aria-hidden="true">
                      <span
                        className="dna-trait-fill"
                        style={{ width: `${Math.round(t.value * 100)}%` }}
                      />
                    </span>
                    <span className="dna-trait-num">
                      {Math.round(t.value * 100)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="fragments">
            <div className="fragments-head">
              <h2>Shell Fragments</h2>
              <p>
                Behavioral mementos, not tradable NFTs. You earned{' '}
                {earnedCount} of {FRAGMENTS.length}.
              </p>
            </div>
            <ul className="fragments-grid">
              {earnedFragments.map((f, i) => (
                <li
                  key={f.id}
                  className={`fragment ${f.isEarned ? 'is-earned' : ''}`}
                  style={{ '--frot': `${((i * 53) % 9) - 4}deg` } as React.CSSProperties}
                >
                  <span className="fragment-shard" aria-hidden="true" />
                  <span className="fragment-name">{f.name}</span>
                  <span className="fragment-line">
                    {f.isEarned ? f.line : 'Not yet. The shell believes in you.'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ */

/**
 * The five-lobed yolk: an organic blob whose lobes stretch with each trait.
 * Built from lobe tips + valleys smoothed with Catmull-Rom → bezier.
 */
function YolkFlower({
  traits,
  active,
  onSelect,
}: {
  traits: Trait[]
  active: string | null
  onSelect: (id: string | null) => void
}) {
  const size = 380
  const c = size / 2
  const baseR = 78
  const lobeR = 62

  const pts: { x: number; y: number }[] = []
  const tips: { x: number; y: number; lx: number; ly: number; trait: Trait }[] = []
  const rad = (deg: number) => deg * (Math.PI / 180)
  const at = (deg: number, r: number) => ({
    x: c + Math.cos(rad(deg)) * r,
    y: c + Math.sin(rad(deg)) * r,
  })

  traits.forEach((t, i) => {
    const tipDeg = -90 + i * 72
    const r = baseR + t.value * lobeR
    // shoulder points on each side of the tip keep the lobes soft and round
    pts.push(at(tipDeg - 15, r * 0.94))
    const tip = at(tipDeg, r)
    pts.push(tip)
    pts.push(at(tipDeg + 15, r * 0.94))
    pts.push(at(tipDeg + 36, baseR * 0.86))
    tips.push({
      ...tip,
      lx: c + Math.cos(rad(tipDeg)) * (r + 30),
      ly: c + Math.sin(rad(tipDeg)) * (r + 30),
      trait: t,
    })
  })

  const d = catmullRomClosed(pts)

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="dna-yolk"
      role="img"
      aria-label={`Decision DNA portrait: ${traits
        .map((t) => `${t.name} ${Math.round(t.value * 100)} out of 100`)
        .join(', ')}`}
    >
      <defs>
        <radialGradient id="yolkFill" cx="42%" cy="36%" r="75%">
          <stop offset="0%" stopColor="#f7c078" />
          <stop offset="55%" stopColor="var(--yolk)" />
          <stop offset="100%" stopColor="#d07f28" />
        </radialGradient>
      </defs>
      <path d={d} fill="url(#yolkFill)" className="dna-yolk-body" />
      <path
        d={d}
        fill="none"
        stroke="rgba(255, 249, 235, 0.35)"
        strokeWidth="2"
      />
      {/* soft highlight, like the mascot's glassy eyes */}
      <ellipse
        cx={c - 34}
        cy={c - 44}
        rx="30"
        ry="20"
        fill="rgba(255,255,255,0.4)"
        transform={`rotate(-18 ${c - 34} ${c - 44})`}
      />
      {tips.map(({ x, y, lx, ly, trait }) => (
        <g key={trait.id}>
          <circle
            cx={x}
            cy={y}
            r={active === trait.id ? 10 : 7}
            className={`dna-lobe-dot ${active === trait.id ? 'is-active' : ''}`}
            onClick={() => onSelect(active === trait.id ? null : trait.id)}
            role="button"
            tabIndex={0}
            aria-label={`${trait.name}: ${Math.round(trait.value * 100)} out of 100`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSelect(active === trait.id ? null : trait.id)
              }
            }}
          />
          <text
            x={lx}
            y={ly}
            textAnchor="middle"
            dominantBaseline="middle"
            className="dna-lobe-label"
          >
            {trait.name}
          </text>
        </g>
      ))}
    </svg>
  )
}

function catmullRomClosed(pts: { x: number; y: number }[]): string {
  const n = pts.length
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n]
    const p1 = pts[i]
    const p2 = pts[(i + 1) % n]
    const p3 = pts[(i + 2) % n]
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
  }
  return d + ' Z'
}
