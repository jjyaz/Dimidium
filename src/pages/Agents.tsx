import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Mascot } from '../components/Mascot'
import { askDimidium, parseTimer, type OracleAnswer } from '../lib/oracle'
import { ASSETS, INTENTIONS, type Asset, type Intention } from '../lib/types'
import { formatUsd } from '../lib/prices'
import './agents.css'

const CURSOR_CONFIG = `{
  "mcpServers": {
    "dimidium": {
      "url": "https://YOUR_HOST/api/public/mcp"
    }
  }
}`

const CLAUDE_CONFIG = `{
  "mcpServers": {
    "dimidium": {
      "type": "http",
      "url": "https://YOUR_HOST/api/public/mcp"
    }
  }
}`

export function Agents() {
  return (
    <section className="page-shell agents" aria-labelledby="agents-heading">
      <header className="agents-head">
        <p className="eyebrow">Hire Dimidium&apos;s twin</p>
        <h1 id="agents-heading">Your other half is an agent now.</h1>
        <p className="agents-sub">
          Dimidium was always meant to be consulted. Now any Claude or Cursor
          session can hire him before aping — via the Model Context Protocol.
          Same egg. Same Washi. Same simulated Hatch versus Shell.
        </p>
        <div className="agents-badges">
          <span className="how-badge">MCP tool · askDimidium</span>
          <span className="sim-note">
            Simulated testnet data — not financial advice
          </span>
        </div>
      </header>

      <div className="agents-hero-row">
        <Mascot variant="small" />
        <blockquote className="agents-quote">
          “You are about to click Buy. Pause. Ask my twin. I will incubate the
          impulse in one tool call and tell you which half looks less foolish.”
          <cite>— Dimidium, whispering washi washi</cite>
        </blockquote>
      </div>

      <EndpointCard />
      <TryIt />
      <ConfigSnippets />

      <div className="agents-cta">
        <h2>Prefer the nursery yourself?</h2>
        <Link className="btn btn-yolk" to="/#composer">
          Incubate a decision
        </Link>
      </div>
    </section>
  )
}

function EndpointCard() {
  const endpoint =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/public/mcp`
      : '/api/public/mcp'

  return (
    <article className="agents-card">
      <h2>The endpoint</h2>
      <p>
        Streamable HTTP, stateless, public. POST JSON-RPC. One tool. No
        session. No account. Just the egg.
      </p>
      <dl className="agents-facts">
        <div>
          <dt>Route</dt>
          <dd>
            <code>{endpoint}</code>
          </dd>
        </div>
        <div>
          <dt>Tool</dt>
          <dd>
            <code>askDimidium(asset, intention, amount, timer)</code>
          </dd>
        </div>
        <div>
          <dt>Returns</dt>
          <dd>
            A Washi-flavored second opinion + live Hatch/Shell projection
          </dd>
        </div>
        <div>
          <dt>Locally</dt>
          <dd>
            <code>npm run mcp</code> then proxy via Vite at{' '}
            <code>/api/public/mcp</code>
          </dd>
        </div>
      </dl>
    </article>
  )
}

function TryIt() {
  const [asset, setAsset] = useState<Asset>('ETH')
  const [intention, setIntention] = useState<Intention>('Buy')
  const [amount, setAmount] = useState('0.5')
  const [timer, setTimer] = useState('24h')
  const [answer, setAnswer] = useState<OracleAnswer | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const amountNum = Number(amount)
  const timerOk = useMemo(() => parseTimer(timer) !== null, [timer])

  const ask = (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount.trim() || Number.isNaN(amountNum) || amountNum <= 0) {
      setError('Give the twin a real amount. It can tell.')
      setAnswer(null)
      return
    }
    if (!timerOk) {
      setError('Timer should look like 15m, 24h, or 7d.')
      setAnswer(null)
      return
    }
    setError(null)
    setBusy(true)
    // Tiny pause so the egg looks like it thought about it.
    window.setTimeout(() => {
      setAnswer(
        askDimidium({ asset, intention, amount: amountNum, timer }),
      )
      setBusy(false)
    }, 420)
  }

  return (
    <article className="agents-card agents-try" aria-labelledby="try-heading">
      <h2 id="try-heading">Try it without hiring anyone</h2>
      <p>
        Same brain the MCP tool uses. No wallet. No contract. Just a second
        opinion.
      </p>

      <form className="agents-form" onSubmit={ask} noValidate>
        <div className="agents-field">
          <span className="lab-label" id="agent-asset">
            Asset
          </span>
          <div className="chip-row" role="radiogroup" aria-labelledby="agent-asset">
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
        </div>

        <div className="agents-field">
          <span className="lab-label" id="agent-intent">
            Intention
          </span>
          <div className="chip-row" role="radiogroup" aria-labelledby="agent-intent">
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

        <div className="agents-field-row">
          <div className="agents-field">
            <label className="lab-label" htmlFor="agent-amount">
              Amount
            </label>
            <input
              id="agent-amount"
              className="lab-input"
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="agents-field">
            <label className="lab-label" htmlFor="agent-timer">
              Timer
            </label>
            <input
              id="agent-timer"
              className="lab-input"
              type="text"
              placeholder="24h"
              value={timer}
              onChange={(e) => setTimer(e.target.value)}
            />
          </div>
        </div>

        {error && (
          <p className="lab-error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="btn btn-yolk" disabled={busy}>
          {busy ? 'Incubating…' : 'Ask Dimidium'}
        </button>
      </form>

      {answer && <OracleCard answer={answer} />}
    </article>
  )
}

function OracleCard({ answer }: { answer: OracleAnswer }) {
  const p = answer.projection
  return (
    <div className="oracle-card" role="status">
      <p className="oracle-whisper">
        🥚 {answer.whisper}{' '}
        <span>(whispered {answer.washiWhispers}×)</span>
      </p>
      <p className="oracle-opinion">{answer.opinion}</p>
      <span className={`oracle-verdict verdict-${answer.verdict}`}>
        {answer.verdict.replace('-', ' ')}
      </span>
      <div className="oracle-paths">
        <div>
          <span className="twin-tag">Hatch</span>
          <strong>{formatUsd(p.hatchValue)}</strong>
          <span className="oracle-caption">act now</span>
        </div>
        <div>
          <span className="twin-tag">Shell</span>
          <strong>{formatUsd(p.shellValue)}</strong>
          <span className="oracle-caption">wait</span>
        </div>
        <div className="oracle-diff">
          <span className="twin-diff-label">Difference</span>
          <strong>
            {p.differenceUsd >= 0 ? '+' : '−'}
            {formatUsd(Math.abs(p.differenceUsd), true)}
          </strong>
          <span className="oracle-caption">
            {p.aheadHalf === 'tie'
              ? 'a genuine tie'
              : `${p.aheadHalf} ahead · ${p.windowLabel}`}
          </span>
        </div>
      </div>
      <p className="oracle-disclaimer">{answer.disclaimer}</p>
    </div>
  )
}

function ConfigSnippets() {
  return (
    <div className="agents-config">
      <article className="agents-card">
        <h2>Cursor</h2>
        <p>
          Drop this into your MCP settings. Point{' '}
          <code>YOUR_HOST</code> at wherever you run{' '}
          <code>npm run mcp</code> (or your deployed twin).
        </p>
        <pre className="agents-code">
          <code>{CURSOR_CONFIG}</code>
        </pre>
      </article>
      <article className="agents-card">
        <h2>Claude</h2>
        <p>
          Same idea. Then ask Claude: “Ask Dimidium whether I should buy 0.5 ETH
          with a 24h timer.”
        </p>
        <pre className="agents-code">
          <code>{CLAUDE_CONFIG}</code>
        </pre>
      </article>
    </div>
  )
}
