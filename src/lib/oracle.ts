/**
 * The Dimidium oracle: the brain behind `askDimidium`.
 *
 * Pure and dependency-free so the MCP server (Node) and the /agents page
 * (browser) run the exact same egg. All prices are simulated; the opinion
 * is vibes with arithmetic. Nothing here is financial advice.
 */
import type { Asset, Intention } from './types'
import { BASE_PRICES, mulberry32, pricePath, formatUsd } from './prices'

export interface OracleQuestion {
  asset: Asset
  intention: Intention
  amount: number
  /** e.g. "15m", "24h", "7d", "36h" */
  timer: string
}

export interface OracleProjection {
  entryPrice: number
  projectedPrice: number
  movePct: number
  hatchValue: number
  shellValue: number
  differenceUsd: number
  aheadHalf: 'hatch' | 'shell' | 'tie'
  windowLabel: string
}

export interface OracleAnswer {
  verdict: 'hatch-leaning' | 'shell-leaning' | 'coin-toss'
  opinion: string
  whisper: string
  washiWhispers: number
  projection: OracleProjection
  disclaimer: string
}

const VOLATILE: Record<Asset, boolean> = {
  ETH: true,
  TSLA: true,
  AAPL: false,
  SPY: false,
}

export function parseTimer(timer: string): number | null {
  const m = /^\s*(\d+(?:\.\d+)?)\s*(m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days)\s*$/i.exec(
    timer,
  )
  if (!m) return null
  const n = Number(m[1])
  if (!Number.isFinite(n) || n <= 0) return null
  const unit = m[2].toLowerCase()
  const perUnit = unit.startsWith('m')
    ? 60_000
    : unit.startsWith('h')
      ? 3_600_000
      : 86_400_000
  const ms = n * perUnit
  if (ms < 60_000 || ms > 365 * 86_400_000) return null
  return ms
}

export function describeTimer(ms: number): string {
  const mins = Math.round(ms / 60_000)
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'}`
  const hours = Math.round(mins / 60)
  if (hours < 48) return `${hours} hour${hours === 1 ? '' : 's'}`
  const days = Math.round(hours / 24)
  return `${days} day${days === 1 ? '' : 's'}`
}

function project(q: OracleQuestion, timerMs: number, seed: number): OracleProjection {
  const rand = mulberry32(seed)
  const entryPrice = BASE_PRICES[q.asset] * (0.97 + rand() * 0.06)
  const path = pricePath(q.asset, seed, entryPrice)
  const projectedPrice = path[path.length - 1]
  const notional = q.amount * entryPrice
  const actWinsWhenUp = q.intention === 'Buy' || q.intention === 'Swap'

  const hatchValue = actWinsWhenUp ? q.amount * projectedPrice : notional
  const shellValue = actWinsWhenUp ? notional : q.amount * projectedPrice
  const differenceUsd = hatchValue - shellValue

  return {
    entryPrice,
    projectedPrice,
    movePct: ((projectedPrice - entryPrice) / entryPrice) * 100,
    hatchValue,
    shellValue,
    differenceUsd,
    aheadHalf:
      Math.abs(differenceUsd) < 0.005 ? 'tie' : differenceUsd > 0 ? 'hatch' : 'shell',
    windowLabel: describeTimer(timerMs),
  }
}

const HATCH_LINES = [
  'The yolk says maybe. The yolk is an optimist.',
  'If you must hatch, hatch on purpose, not on impulse.',
  'One of my timelines liked it. The other one is sulking.',
] as const

const SHELL_LINES = [
  'The shell supports doing absolutely nothing. The shell is very good at this.',
  'I incubated your idea and it fell asleep. Take the hint.',
  'Future you called. They said thanks for waiting.',
] as const

const TOSS_LINES = [
  'Both halves shrugged at the same time. Spooky.',
  'This one is a true coin toss, and I do not carry coins. I am an egg.',
  'The difference is smaller than my anxiety. Proceed however you like.',
] as const

function pick<T>(lines: readonly T[], rand: () => number): T {
  return lines[Math.floor(rand() * lines.length)]
}

/**
 * Ask the egg. Same simulated brain the app uses, plus editorializing.
 */
export function askDimidium(q: OracleQuestion, seed = Math.floor(Math.random() * 1_000_000)): OracleAnswer {
  const timerMs = parseTimer(q.timer) ?? 24 * 3_600_000
  const projection = project(q, timerMs, seed)
  const rand = mulberry32(seed + 7)

  const notional = q.amount * projection.entryPrice
  const edgePct = notional > 0 ? Math.abs(projection.differenceUsd) / notional : 0

  const verdict: OracleAnswer['verdict'] =
    edgePct < 0.004
      ? 'coin-toss'
      : projection.aheadHalf === 'hatch'
        ? 'hatch-leaning'
        : 'shell-leaning'

  const caveats: string[] = []
  if (VOLATILE[q.asset] && timerMs <= 30 * 60_000) {
    caveats.push(
      `A ${projection.windowLabel} timer on ${q.asset} is not incubation, it is a microwave.`,
    )
  }
  if (notional >= 10_000) {
    caveats.push(
      `That is ${formatUsd(notional, true)} of almost. Big eggs deserve long sits.`,
    )
  }
  if (q.intention === 'Transfer') {
    caveats.push('Transfers rarely miss the market. They mostly miss the point.')
  }

  const lead =
    verdict === 'hatch-leaning'
      ? pick(HATCH_LINES, rand)
      : verdict === 'shell-leaning'
        ? pick(SHELL_LINES, rand)
        : pick(TOSS_LINES, rand)

  const diffLabel = formatUsd(Math.abs(projection.differenceUsd), true)
  const summary =
    projection.aheadHalf === 'tie'
      ? `Over one simulated ${projection.windowLabel} window the two futures land within a rounding error of each other.`
      : `Over one simulated ${projection.windowLabel} window, ${
          projection.aheadHalf === 'hatch' ? 'acting' : 'waiting'
        } comes out ahead by about ${diffLabel}.`

  return {
    verdict,
    opinion: [lead, summary, ...caveats].join(' '),
    whisper: 'Washi washi.',
    washiWhispers: 1 + Math.floor(rand() * 3),
    projection,
    disclaimer:
      'Simulated testnet data from a clay egg. Not financial advice. No eggs were traded.',
  }
}
