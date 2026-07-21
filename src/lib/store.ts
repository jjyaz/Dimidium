/**
 * Demo decision store, persisted in localStorage.
 * A tiny external store so every component sees the same eggs.
 */
import { useSyncExternalStore } from 'react'
import type { Asset, Decision, Intention, Privacy } from './types'
import { assetUnit } from './types'
import { BASE_PRICES, mulberry32 } from './prices'

const STORAGE_KEY = 'dimidium.decisions.v1'
const SEED_FLAG = 'dimidium.seeded.v1'

let decisions: Decision[] = []
let snapshot: Decision[] = []
const listeners = new Set<() => void>()

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(decisions))
  } catch {
    // Storage may be unavailable (private mode); demo continues in memory.
  }
  snapshot = [...decisions]
  listeners.forEach((l) => l())
}

function load(): Decision[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Decision[]
  } catch {
    // fall through to seeding
  }
  return []
}

function makeSeedDecisions(): Decision[] {
  const now = Date.now()
  const h = 60 * 60 * 1000
  const d = 24 * h
  const mk = (
    partial: Omit<
      Decision,
      'id' | 'unit' | 'entryPrice' | 'seed' | 'extensions'
    > & { seed: number },
  ): Decision => ({
    ...partial,
    id: `seed-${partial.seed}`,
    unit: assetUnit(partial.asset),
    entryPrice:
      BASE_PRICES[partial.asset] *
      (0.94 + mulberry32(partial.seed)() * 0.12),
    extensions: 0,
  })

  return [
    mk({
      asset: 'ETH',
      intention: 'Buy',
      amount: 0.5,
      note: 'Everyone on the timeline says it is going up. That is usually when I get it wrong.',
      privacy: 'private',
      createdAt: now - 2 * d,
      incubationMs: 7 * d,
      hatchesAt: now - 2 * d + 7 * d,
      seed: 11,
    }),
    mk({
      asset: 'TSLA',
      intention: 'Sell',
      amount: 12,
      note: 'Earnings tomorrow. My thumb is hovering. I want to see if the fear survives a day.',
      privacy: 'public',
      createdAt: now - 30 * 60 * 1000,
      incubationMs: 24 * h,
      hatchesAt: now - 30 * 60 * 1000 + 24 * h,
      seed: 27,
    }),
    mk({
      asset: 'AAPL',
      intention: 'Buy',
      amount: 8,
      note: 'Dip felt dramatic in the moment. Future me: was it actually dramatic?',
      privacy: 'private',
      createdAt: now - 9 * d,
      incubationMs: 7 * d,
      hatchesAt: now - 9 * d + 7 * d,
      resolvedAt: now - 2 * d + 3 * h,
      resolution: 'hatched',
      seed: 42,
    }),
    mk({
      asset: 'SPY',
      intention: 'Swap',
      amount: 5,
      note: 'Wanted to rotate into something spicier. The shell talked me down.',
      privacy: 'private',
      createdAt: now - 14 * d,
      incubationMs: 24 * h,
      hatchesAt: now - 13 * d,
      resolvedAt: now - 13 * d + h,
      resolution: 'shelled',
      seed: 63,
    }),
  ]
}

function init() {
  decisions = load()
  let seeded = false
  try {
    seeded = localStorage.getItem(SEED_FLAG) === '1'
  } catch {
    seeded = false
  }
  if (decisions.length === 0 && !seeded) {
    decisions = makeSeedDecisions()
    try {
      localStorage.setItem(SEED_FLAG, '1')
    } catch {
      // ignore
    }
  }
  snapshot = [...decisions]
  persist()
}

init()

export const decisionStore = {
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  getSnapshot(): Decision[] {
    return snapshot
  },
  create(input: {
    asset: Asset
    intention: Intention
    amount: number
    note: string
    privacy: Privacy
    incubationMs: number
  }): Decision {
    const now = Date.now()
    const seed = Math.floor(Math.random() * 1_000_000)
    const jitter = 0.97 + mulberry32(seed + 1)() * 0.06
    const decision: Decision = {
      id: `egg-${now.toString(36)}-${seed.toString(36)}`,
      asset: input.asset,
      intention: input.intention,
      amount: input.amount,
      unit: assetUnit(input.asset),
      note: input.note,
      privacy: input.privacy,
      createdAt: now,
      incubationMs: input.incubationMs,
      hatchesAt: now + input.incubationMs,
      extensions: 0,
      entryPrice: BASE_PRICES[input.asset] * jitter,
      seed,
    }
    decisions = [decision, ...decisions]
    persist()
    return decision
  },
  resolve(id: string, resolution: 'hatched' | 'shelled') {
    decisions = decisions.map((d) =>
      d.id === id ? { ...d, resolution, resolvedAt: Date.now() } : d,
    )
    persist()
  },
  extend(id: string, extraMs: number) {
    decisions = decisions.map((d) =>
      d.id === id
        ? {
            ...d,
            hatchesAt: Math.max(d.hatchesAt, Date.now()) + extraMs,
            extensions: d.extensions + 1,
            resolution: undefined,
            resolvedAt: undefined,
          }
        : d,
    )
    persist()
  },
}

export function useDecisions(): Decision[] {
  return useSyncExternalStore(
    decisionStore.subscribe,
    decisionStore.getSnapshot,
  )
}

export function useDecision(id: string | undefined): Decision | undefined {
  const all = useDecisions()
  return all.find((d) => d.id === id)
}
