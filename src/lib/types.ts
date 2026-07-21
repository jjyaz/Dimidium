export type Asset = 'ETH' | 'AAPL' | 'TSLA' | 'SPY'
export type Intention = 'Buy' | 'Sell' | 'Swap' | 'Transfer'
export type Privacy = 'private' | 'public'

export type DecisionState =
  | 'incubating'
  | 'ready'
  | 'hatched'
  | 'shelled'

export interface Decision {
  id: string
  asset: Asset
  intention: Intention
  amount: number
  /** Unit for the amount — ETH for ETH, shares otherwise. */
  unit: string
  note: string
  privacy: Privacy
  createdAt: number
  /** Incubation length in milliseconds. */
  incubationMs: number
  /** createdAt + incubationMs (+ any extensions). */
  hatchesAt: number
  /** How many times the user asked for more time. */
  extensions: number
  /** Set when the user hatches or shells the decision. */
  resolvedAt?: number
  resolution?: 'hatched' | 'shelled'
  /** Price of the asset when the decision was created (simulated). */
  entryPrice: number
  /** Random seed so each decision gets its own stable price path. */
  seed: number
}

export interface FragmentDef {
  id: string
  name: string
  line: string
  earned: (decisions: Decision[]) => boolean
}

export const ASSETS: Asset[] = ['ETH', 'AAPL', 'TSLA', 'SPY']
export const INTENTIONS: Intention[] = ['Buy', 'Sell', 'Swap', 'Transfer']

export const INCUBATION_PRESETS = [
  { label: '15 minutes', ms: 15 * 60 * 1000 },
  { label: '24 hours', ms: 24 * 60 * 60 * 1000 },
  { label: '7 days', ms: 7 * 24 * 60 * 60 * 1000 },
] as const

/** Live state, derived from stored state + the clock. */
export function liveState(d: Decision, now = Date.now()): DecisionState {
  if (d.resolution === 'hatched') return 'hatched'
  if (d.resolution === 'shelled') return 'shelled'
  return now >= d.hatchesAt ? 'ready' : 'incubating'
}

export function assetUnit(asset: Asset): string {
  return asset === 'ETH' ? 'ETH' : 'shares'
}
