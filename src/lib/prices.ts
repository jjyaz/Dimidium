/**
 * Simulated testnet price engine.
 *
 * All numbers here are fake. Each decision carries a numeric seed, and the
 * price path is generated deterministically from it, so a decision's twin
 * timelines look the same on every visit.
 *
 * Paths and twin outcomes are memoized so incubation UIs can tick a countdown
 * without constantly regenerating walks or "re-subscribing" to the same quote.
 */
import type { Asset, Decision } from './types'
import { MemoCache } from './cache'

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

/** How long a demo spot quote is considered fresh enough to reuse. */
export const PRICE_QUOTE_TTL_MS = 30_000

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
  /** Path index used — stable until progress moves a full step. */
  pathIndex: number
}

const pathCache = new MemoCache<number[]>(96)
const outcomeCache = new MemoCache<TwinOutcome>(128)

/** Soft TTL for demo spot quotes reused by the composer / nursery. */
const spotQuotes = new Map<Asset, { price: number; fetchedAt: number }>()

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

function buildPricePath(
  asset: Asset,
  seed: number,
  start: number,
  points: number,
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

/**
 * Generates a smooth-ish random walk of `points` prices starting at `start`.
 * Deterministic for a given (asset, seed, start, points) and memoized.
 */
export function pricePath(
  asset: Asset,
  seed: number,
  start: number,
  points = 48,
): number[] {
  const key = `${asset}:${seed}:${start.toFixed(6)}:${points}`
  return pathCache.getOrCompute(key, () =>
    buildPricePath(asset, seed, start, points),
  )
}

/**
 * Demo spot quote for an asset. Cached for PRICE_QUOTE_TTL_MS so composer /
 * nursery screens do not keep re-reading the same base price every render.
 */
export function getCachedSpotPrice(
  asset: Asset,
  now = Date.now(),
): { price: number; fromCache: boolean; fetchedAt: number } {
  const hit = spotQuotes.get(asset)
  if (hit && now - hit.fetchedAt < PRICE_QUOTE_TTL_MS) {
    return { price: hit.price, fromCache: true, fetchedAt: hit.fetchedAt }
  }
  const fresh = { price: BASE_PRICES[asset], fetchedAt: now }
  spotQuotes.set(asset, fresh)
  return { price: fresh.price, fromCache: false, fetchedAt: fresh.fetchedAt }
}

function pathIndexFor(d: Decision, now: number, pathLen: number): number {
  const total = d.hatchesAt - d.createdAt
  const elapsed = Math.min(Math.max(now - d.createdAt, 0), total)
  const progress = total > 0 ? elapsed / total : 1
  return Math.min(
    pathLen - 1,
    Math.max(1, Math.round(progress * (pathLen - 1))),
  )
}

/**
 * Compares the two timelines for a decision.
 *
 * HATCH assumes the intention executed at the entry price.
 * SHELL assumes the user did nothing.
 * For Buy/Swap, acting wins when price goes up. For Sell/Transfer,
 * acting wins when price goes down (they'd have gotten out first).
 *
 * Results are memoized by decision id + path index so a 1Hz countdown does
 * not rebuild the twin chart on every tick.
 */
export function twinOutcome(d: Decision, now = Date.now()): TwinOutcome {
  const path = pricePath(d.asset, d.seed, d.entryPrice)
  const idx = pathIndexFor(d, now, path.length)
  const key = `${d.id}:${d.hatchesAt}:${idx}:${d.resolution ?? 'open'}`

  return outcomeCache.getOrCompute(key, () => {
    const currentPrice = path[idx]
    const notional = d.amount * d.entryPrice
    const movePct = ((currentPrice - d.entryPrice) / d.entryPrice) * 100

    const actWinsWhenUp = d.intention === 'Buy' || d.intention === 'Swap'
    const hatchValue = actWinsWhenUp
      ? d.amount * currentPrice
      : notional
    const shellValue = actWinsWhenUp
      ? notional
      : d.amount * currentPrice

    return {
      path: path.slice(0, idx + 1),
      entryPrice: d.entryPrice,
      currentPrice,
      hatchValue,
      shellValue,
      differenceUsd: hatchValue - shellValue,
      movePct,
      pathIndex: idx,
    }
  })
}

/** Test / hot-reload helper. */
export function clearPriceCaches() {
  pathCache.clear()
  outcomeCache.clear()
  spotQuotes.clear()
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
