import { Link } from 'react-router-dom'
import { ClayEgg } from '../components/ClayEgg'
import { robinhoodChainTestnet } from '../chain/config'
import './how.css'

const STEPS = [
  {
    n: 1,
    title: 'A decision becomes a commitment',
    body: 'Your private intention is converted into a commitment — a sealed envelope that proves the thought existed without exposing what it says.',
  },
  {
    n: 2,
    title: 'Robinhood Chain timestamps it',
    body: 'The chain records when the commitment was made. From that moment, nobody — including you — can quietly rewrite the story.',
  },
  {
    n: 3,
    title: 'Price feeds watch both futures',
    body: 'Oracle price feeds can compare what happened after you acted with what would have happened if you had waited.',
  },
  {
    n: 4,
    title: 'You reveal or resolve it later',
    body: 'When incubation ends, you open the envelope: hatch the decision, return it to the shell, or extend the timer.',
  },
  {
    n: 5,
    title: 'Someday, rules that hold',
    body: 'A future smart-wallet version may enforce waiting rules you write for yourself — a cooling-off period your impulses cannot veto.',
  },
]

export function HowItWorks() {
  return (
    <section className="page-shell how" aria-labelledby="how-heading">
      <header className="how-head">
        <p className="eyebrow">The architecture, gently</p>
        <h1 id="how-heading">How Dimidium works</h1>
        <p className="how-sub">
          Blockchains are very good at remembering. Dimidium points that memory
          at the half of every decision that normally evaporates.
        </p>
        <div className="how-badges">
          <span className="how-badge">
            <span className="chain-dot" aria-hidden="true" />
            Designed for Robinhood Chain
          </span>
          <span className="sim-note">
            Prototype mode uses simulated data and does not execute trades.
          </span>
        </div>
      </header>

      <ol className="how-steps">
        {STEPS.map((s, i) => (
          <li key={s.n} className={`how-step how-step-${(i % 3) + 1}`}>
            <span className="how-step-n" aria-hidden="true">
              {String(s.n).padStart(2, '0')}
            </span>
            <div>
              <h2>{s.title}</h2>
              <p>{s.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="how-chain">
        <ClayEgg mode="trembling" size={72} />
        <div>
          <h2>Robinhood Chain Testnet</h2>
          <dl className="how-chain-facts">
            <div>
              <dt>Chain ID</dt>
              <dd>{robinhoodChainTestnet.id}</dd>
            </div>
            <div>
              <dt>Native currency</dt>
              <dd>{robinhoodChainTestnet.nativeCurrency.symbol}</dd>
            </div>
            <div>
              <dt>RPC</dt>
              <dd>
                <code>{robinhoodChainTestnet.rpcUrls.default.http[0]}</code>
              </dd>
            </div>
            <div>
              <dt>Explorer</dt>
              <dd>
                <a
                  href={robinhoodChainTestnet.blockExplorers.default.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {robinhoodChainTestnet.blockExplorers.default.url.replace('https://', '')}
                </a>
              </dd>
            </div>
          </dl>
          <p className="how-demo-note">
            Demo Mode — no contract connected. The site works fully without a
            wallet; nothing here executes a real trade.
          </p>
        </div>
      </div>

      <div className="how-cta">
        <h2>Ready to meet your other half?</h2>
        <Link className="btn btn-yolk" to="/#composer">
          Incubate a decision
        </Link>
      </div>
    </section>
  )
}
