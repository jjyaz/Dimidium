/**
 * Shell yield — Atelier Earn / Solend integration.
 *
 * When a user shells a decision, we reframe "doing nothing" as an opportunity
 * cost story: the USD notional of that egg could have been napping in Atelier
 * Earn (Solend USDC supply) instead of sitting idle in the decision.
 *
 * APY is pulled live from Solend's public REST API. If the call fails we fall
 * back to a last-known cache / conservative default so Demo Mode never blanks.
 */
import { useEffect, useState } from 'react'
import type { Decision } from './types'
import { formatAmount } from './prices'

/** Solend main-market USDC reserve (production). */
export const SOLEND_USDC_RESERVE =
  'BgxfHJDzm44T7XG68MYKx7YisTjZu73tVovyZSjJMpmw'

const SOLEND_URL = `https://api.solend.fi/v1/reserves?ids=${SOLEND_USDC_RESERVE}`
const CACHE_KEY = 'dimidium.solend.usdc.apy.v1'
const CACHE_TTL_MS = 15 * 60 * 1000

/** Conservative fallback if Solend is unreachable (~mid-single-digit USDC lend). */
export const FALLBACK_USDC_APY = 0.035

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

interface CacheBlob {
  apy: number
  fetchedAt: number
}

function readCache(): CacheBlob | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CacheBlob
    if (!Number.isFinite(parsed.apy) || parsed.apy <= 0) return null
    return parsed
  } catch {
    return null
  }
}

function writeCache(apy: number, fetchedAt: number) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ apy, fetchedAt }))
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

/**
 * Fetch Solend USDC supply APY. Prefer fresh network data; fall back to a
 * short-lived local cache, then to FALLBACK_USDC_APY.
 */
export async function fetchSolendUsdcApy(
  signal?: AbortSignal,
): Promise<SolendApyQuote> {
  const cached = typeof localStorage !== 'undefined' ? readCache() : null
  const now = Date.now()

  try {
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
    const apy = supplyInterest / 100
    writeCache(apy, now)
    return toQuote(apy, 'solend', now)
  } catch {
    if (cached && now - cached.fetchedAt < CACHE_TTL_MS * 8) {
      return toQuote(cached.apy, 'cache', cached.fetchedAt)
    }
    if (cached) return toQuote(cached.apy, 'cache', cached.fetchedAt)
    return toQuote(FALLBACK_USDC_APY, 'fallback', now)
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
  // Simple pro-rata over the nap. Clearer than compound for short incubations.
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
  const [quote, setQuote] = useState<SolendApyQuote | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!decision || decision.resolution !== 'shelled') {
      setLoading(false)
      return
    }
    const ctrl = new AbortController()
    setLoading(true)
    fetchSolendUsdcApy(ctrl.signal)
      .then((q) => {
        setQuote(q)
        setError(q.source === 'fallback' ? 'Using fallback APY — Solend was quiet.' : null)
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
