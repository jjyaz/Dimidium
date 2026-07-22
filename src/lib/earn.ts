/**
 * Shell yield — Atelier Earn / Solend integration.
 *
 * When a user shells a decision, we reframe "doing nothing" as an opportunity
 * cost story: the USD notional of that egg could have been napping in Atelier
 * Earn (Solend USDC supply) instead of sitting idle in the decision.
 *
 * APY lookups are TTL-cached (memory + localStorage) with in-flight coalescing
 * so incubation / detail screens never constantly re-subscribe to Solend.
 */
import { useEffect, useState } from 'react'
import type { Decision } from './types'
import { formatAmount } from './prices'
import { TtlCache } from './cache'

/** Solend main-market USDC reserve (production). */
export const SOLEND_USDC_RESERVE =
  'BgxfHJDzm44T7XG68MYKx7YisTjZu73tVovyZSjJMpmw'

const SOLEND_URL = `https://api.solend.fi/v1/reserves?ids=${SOLEND_USDC_RESERVE}`
const STORAGE_KEY = 'dimidium.solend.usdc.apy.v1'
/** Soft TTL — prefer cache, skip network. */
export const APY_TTL_MS = 15 * 60 * 1000
/** Hard max age for stale-while-revalidate / offline fallback. */
export const APY_MAX_AGE_MS = 2 * 60 * 60 * 1000

/** Conservative fallback if Solend is unreachable (~mid-single-digit USDC lend). */
export const FALLBACK_USDC_APY = 0.035

const APY_KEY = 'usdc-supply'

const memoryApy = new TtlCache<SolendApyQuote>({
  ttlMs: APY_TTL_MS,
  maxAgeMs: APY_MAX_AGE_MS,
})

export interface SolendApyQuote {
  /** Decimal APY, e.g. 0.025 for 2.5%. */
  apy: number
  /** Percent form for display, e.g. 2.5. */
  apyPct: number
  source: 'solend' | 'cache' | 'fallback'
  fetchedAt: number
  reserve: string
}

export interface ShellYield {
  assetLabel: string
  notionalUsd: number
  waitMs: number
  waitLabel: string
  apy: SolendApyQuote
  /** Simple pro-rata yield over the wait: notional * apy * years. */
  earnedUsd: number
  /** Effective percent earned over the wait window (not annualized). */
  earnedPct: number
  headline: string
  body: string
}

interface StorageBlob {
  apy: number
  fetchedAt: number
}

function readStorage(): StorageBlob | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StorageBlob
    if (!Number.isFinite(parsed.apy) || parsed.apy < 0) return null
    return parsed
  } catch {
    return null
  }
}

function writeStorage(apy: number, fetchedAt: number) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ apy, fetchedAt }))
  } catch {
    // ignore
  }
}

function toQuote(
  apy: number,
  source: SolendApyQuote['source'],
  fetchedAt: number,
): SolendApyQuote {
  return {
    apy,
    apyPct: apy * 100,
    source,
    fetchedAt,
    reserve: SOLEND_USDC_RESERVE,
  }
}

async function loadFromSolend(signal?: AbortSignal): Promise<SolendApyQuote> {
  const res = await fetch(SOLEND_URL, {
    signal,
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`Solend ${res.status}`)
  const data = (await res.json()) as {
    results?: Array<{ rates?: { supplyInterest?: string } }>
  }
  const supplyInterest = Number(data.results?.[0]?.rates?.supplyInterest)
  if (!Number.isFinite(supplyInterest) || supplyInterest < 0) {
    throw new Error('Solend APY missing')
  }
  const now = Date.now()
  const quote = toQuote(supplyInterest / 100, 'solend', now)
  writeStorage(quote.apy, now)
  return quote
}

function storageAsQuote(blob: StorageBlob, now: number): SolendApyQuote | null {
  if (now - blob.fetchedAt > APY_MAX_AGE_MS) return null
  const fresh = now - blob.fetchedAt < APY_TTL_MS
  return toQuote(blob.apy, fresh ? 'cache' : 'cache', blob.fetchedAt)
}

/**
 * Fetch Solend USDC supply APY.
 *
 * Order: fresh memory → fresh localStorage → network (coalesced) →
 * stale memory/storage → FALLBACK_USDC_APY.
 */
export async function fetchSolendUsdcApy(
  signal?: AbortSignal,
): Promise<SolendApyQuote> {
  const now = Date.now()

  const memFresh = memoryApy.getFresh(APY_KEY)
  if (memFresh) return { ...memFresh, source: 'cache' }

  const stored = typeof localStorage !== 'undefined' ? readStorage() : null
  if (stored && now - stored.fetchedAt < APY_TTL_MS) {
    const quote = toQuote(stored.apy, 'cache', stored.fetchedAt)
    memoryApy.set(APY_KEY, quote)
    return quote
  }

  try {
    const { value, fromCache } = await memoryApy.getOrLoad(APY_KEY, () =>
      loadFromSolend(signal),
    )
    // getOrLoad may return a just-written solend quote; preserve source.
    if (fromCache) return { ...value, source: 'cache' }
    return value
  } catch {
    const memStale = memoryApy.getStale(APY_KEY)
    if (memStale) return { ...memStale, source: 'cache' }
    if (stored) {
      const quote = storageAsQuote(stored, now)
      if (quote) return quote
    }
    return toQuote(FALLBACK_USDC_APY, 'fallback', now)
  }
}

/** Synchronous peek for UI that must not kick off a fetch. */
export function peekSolendUsdcApy(): SolendApyQuote | null {
  const mem = memoryApy.getStale(APY_KEY)
  if (mem) return mem
  if (typeof localStorage === 'undefined') return null
  const stored = readStorage()
  if (!stored) return null
  return storageAsQuote(stored, Date.now())
}

export function clearApyCaches() {
  memoryApy.clear()
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

export function describeWait(ms: number): string {
  const mins = Math.max(1, Math.round(ms / 60_000))
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'}`
  const hours = Math.round(mins / 60)
  if (hours < 48) return `${hours} hour${hours === 1 ? '' : 's'}`
  const days = Math.round(hours / 24)
  return `${days} day${days === 1 ? '' : 's'}`
}

export function assetLabel(d: Decision): string {
  return d.asset === 'ETH'
    ? `${formatAmount(d.amount)} ETH`
    : `${formatAmount(d.amount)} ${d.asset}`
}

/**
 * Turn a shelled decision + Solend APY into an Atelier Earn yield story.
 */
export function computeShellYield(
  decision: Decision,
  apy: SolendApyQuote,
): ShellYield {
  const end = decision.resolvedAt ?? decision.hatchesAt
  const waitMs = Math.max(end - decision.createdAt, 60_000)
  const years = waitMs / (365.25 * 24 * 60 * 60 * 1000)
  const notionalUsd = decision.amount * decision.entryPrice
  const earnedUsd = Math.max(0, notionalUsd * apy.apy * years)
  const earnedPct = notionalUsd > 0 ? (earnedUsd / notionalUsd) * 100 : 0
  const label = assetLabel(decision)
  const waitLabel = describeWait(waitMs)
  const apyDisplay = formatPct(apy.apyPct)

  return {
    assetLabel: label,
    notionalUsd,
    waitMs,
    waitLabel,
    apy,
    earnedUsd,
    earnedPct,
    headline: `Your shelled ${label} could've earned ${apyDisplay}% in Atelier Earn while it napped.`,
    body: `Over ${waitLabel}, that idle ~$${notionalUsd.toFixed(0)} notional at Solend's live USDC supply rate (${apyDisplay}% APY) works out to about $${earnedUsd.toFixed(2)} of Shell yield.`,
  }
}

export function formatPct(n: number): string {
  return n >= 10 ? n.toFixed(1) : n.toFixed(2)
}

export function useShellYield(decision: Decision | undefined): {
  yieldInfo: ShellYield | null
  loading: boolean
  error: string | null
} {
  const peeked =
    decision?.resolution === 'shelled' ? peekSolendUsdcApy() : null
  const [quote, setQuote] = useState<SolendApyQuote | null>(peeked)
  const [loading, setLoading] = useState(!peeked)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!decision || decision.resolution !== 'shelled') {
      setLoading(false)
      return
    }

    const cached = peekSolendUsdcApy()
    if (cached && Date.now() - cached.fetchedAt < APY_TTL_MS) {
      setQuote(cached)
      setLoading(false)
      setError(null)
      return
    }

    const ctrl = new AbortController()
    if (!cached) setLoading(true)
    else setQuote(cached)

    fetchSolendUsdcApy(ctrl.signal)
      .then((q) => {
        setQuote(q)
        setError(
          q.source === 'fallback'
            ? 'Using fallback APY — Solend was quiet.'
            : null,
        )
      })
      .catch(() => {
        setQuote(toQuote(FALLBACK_USDC_APY, 'fallback', Date.now()))
        setError('Using fallback APY — Solend was quiet.')
      })
      .finally(() => setLoading(false))

    return () => ctrl.abort()
  }, [decision?.id, decision?.resolution])

  if (!decision || decision.resolution !== 'shelled') {
    return { yieldInfo: null, loading: false, error: null }
  }

  return {
    yieldInfo: quote ? computeShellYield(decision, quote) : null,
    loading,
    error,
  }
}
