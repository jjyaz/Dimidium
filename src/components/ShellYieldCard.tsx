import type { Decision } from '../lib/types'
import { useShellYield } from '../lib/earn'
import { formatUsd } from '../lib/prices'
import './shellYield.css'

/**
 * Turns "you did nothing" into a yield story: what the shelled notional
 * could have earned napping in Atelier Earn (Solend USDC supply APY).
 */
export function ShellYieldCard({ decision }: { decision: Decision }) {
  const { yieldInfo, loading, error } = useShellYield(decision)

  if (loading && !yieldInfo) {
    return (
      <aside className="shell-yield is-loading" aria-busy="true">
        <p className="shell-yield-eyebrow">Shell yield</p>
        <p>Asking Solend what Atelier Earn is paying…</p>
      </aside>
    )
  }

  if (!yieldInfo) return null

  const sourceLabel =
    yieldInfo.apy.source === 'solend'
      ? 'Live from Solend'
      : yieldInfo.apy.source === 'cache'
        ? 'Cached Solend rate'
        : 'Fallback rate'

  return (
    <aside className="shell-yield" aria-label="Shell yield from Atelier Earn">
      <div className="shell-yield-top">
        <p className="shell-yield-eyebrow">Shell yield · Atelier Earn</p>
        <span className="shell-yield-source">{sourceLabel}</span>
      </div>
      <h3 className="shell-yield-headline">{yieldInfo.headline}</h3>
      <p className="shell-yield-body">{yieldInfo.body}</p>
      <dl className="shell-yield-facts">
        <div>
          <dt>Solend USDC APY</dt>
          <dd>{yieldInfo.apy.apyPct.toFixed(2)}%</dd>
        </div>
        <div>
          <dt>Nap length</dt>
          <dd>{yieldInfo.waitLabel}</dd>
        </div>
        <div>
          <dt>Could&apos;ve earned</dt>
          <dd className="shell-yield-earned">
            {formatUsd(yieldInfo.earnedUsd)}
          </dd>
        </div>
      </dl>
      {error && (
        <p className="shell-yield-note" role="status">
          {error}
        </p>
      )}
      <p className="shell-yield-fine">
        Illustrative only — Solend supply APY on USDC, applied to your shelled
        notional. Not a deposit, not a promise, not financial advice.
      </p>
      <a
        className="shell-yield-link"
        href="https://useatelier.ai/"
        target="_blank"
        rel="noreferrer"
      >
        Peek at Atelier Earn →
      </a>
    </aside>
  )
}
