/**
 * Simulated testnet price engine.
 *
 * All numbers here are fake. Each decision carries a numeric seed, and the
 * price path is generated deterministically from it, so a decision's twin
 * timelines look the same on every visit.
 */
import type { Asset, Decision } from './types'

export const BASE_PRICES: Record<Asset, number> = {
  ETH: 3240.5,
  AAPL: 228.4,
  TSLA: 342.9,
  SPY: 601.2,
}

const VOLATILITY: Record<Asset, number> = {
  ETH: 0.045,
  AAPL: 0.014,
  TSLA: 0.038,
  SPY: 0.008,
}

/** Small deterministic PRNG (mulberry32). */
export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Generates a smooth-ish random walk of `points` prices starting at `start`.
 */
export function pricePath(
  asset: Asset,
  seed: number,
  start: number,
  points = 48,
): number[] {
  const rand = mulberry32(seed)
  const vol = VOLATILITY[asset]
  const out: number[] = [start]
  let momentum = 0
  for (let i = 1; i < points; i++) {
    const shock = (rand() - 0.5) * 2 * vol
    momentum = momentum * 0.82 + shock * 0.5
    const prev = out[i - 1]
    out.push(Math.max(prev * (1 + momentum + shock * 0.4), start * 0.4))
  }
  return out
}

export interface TwinOutcome {
  /** Simulated prices for the incubation window. */
  path: number[]
  entryPrice: number
  currentPrice: number
  /** Value of the position had the user acted immediately. */
  hatchValue: number
  /** Value of simply holding what they already had (waiting). */
  shellValue: number
  /** hatchValue - shellValue; positive means acting would have won. */
  differenceUsd: number
  /** Percent move of the asset over the observed window. */
  movePct: number
}

/**
 * Compares the two timelines for a decision.
 *
 * HATCH assumes the intention executed at the entry price.
 * SHELL assumes the user did nothing.
 * For Buy/Swap, acting wins when price goes up. For Sell/Transfer,
 * acting wins when price goes down (they'd have gotten out first).
 */
export function twinOutcome(d: Decision, now = Date.now()): TwinOutcome {
  const path = pricePath(d.asset, d.seed, d.entryPrice)
  const total = d.hatchesAt - d.createdAt
  const elapsed = Math.min(Math.max(now - d.createdAt, 0), total)
  const progress = total > 0 ? elapsed / total : 1
  const idx = Math.min(
    path.length - 1,
    Math.max(1, Math.round(progress * (path.length - 1))),
  )
  const currentPrice = path[idx]
  const notional = d.amount * d.entryPrice
  const movePct = ((currentPrice - d.entryPrice) / d.entryPrice) * 100

  const actWinsWhenUp = d.intention === 'Buy' || d.intention === 'Swap'
  const hatchValue = actWinsWhenUp
    ? d.amount * currentPrice
    : notional // sold/transferred at entry, value locked in
  const shellValue = actWinsWhenUp
    ? notional // still holding cash
    : d.amount * currentPrice // still holding the asset

  return {
    path: path.slice(0, idx + 1),
    entryPrice: d.entryPrice,
    currentPrice,
    hatchValue,
    shellValue,
    differenceUsd: hatchValue - shellValue,
    movePct,
  }
}

export function formatUsd(n: number, compact = false): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: compact ? 0 : 2,
  }).format(n)
}

export function formatAmount(n: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 }).format(n)
}
