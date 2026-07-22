/**
 * Smoke checks for price/APY TTL caches — no constant re-fetch during incubation.
 */
import assert from 'node:assert/strict'
import {
  clearPriceCaches,
  getCachedSpotPrice,
  pricePath,
  twinOutcome,
  PRICE_QUOTE_TTL_MS,
} from '../src/lib/prices.ts'
import {
  clearApyCaches,
  fetchSolendUsdcApy,
  peekSolendUsdcApy,
  APY_TTL_MS,
} from '../src/lib/earn.ts'

const results = []
const check = (name, ok, extra = '') => {
  results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ` — ${extra}` : ''}`)
}

clearPriceCaches()
clearApyCaches()

// Spot quotes reuse within TTL
const a = getCachedSpotPrice('ETH', 1_000)
const b = getCachedSpotPrice('ETH', 1_000 + PRICE_QUOTE_TTL_MS - 1)
check('spot quote cached within TTL', a.fromCache === false && b.fromCache === true)
const c = getCachedSpotPrice('ETH', 1_000 + PRICE_QUOTE_TTL_MS + 1)
check('spot quote refreshes after TTL', c.fromCache === false)

// Price paths are referentially stable
const p1 = pricePath('ETH', 42, 3000)
const p2 = pricePath('ETH', 42, 3000)
check('pricePath memoized by identity', p1 === p2)

const now = Date.now()
/** @type {import('../src/lib/types.ts').Decision} */
const decision = {
  id: 'cache-egg',
  asset: 'ETH',
  intention: 'Buy',
  amount: 1,
  unit: 'ETH',
  note: '',
  privacy: 'private',
  createdAt: now - 60_000,
  incubationMs: 24 * 3600_000,
  hatchesAt: now - 60_000 + 24 * 3600_000,
  extensions: 0,
  entryPrice: 3000,
  seed: 42,
}

const o1 = twinOutcome(decision, now)
const o2 = twinOutcome(decision, now + 500) // same path index
check(
  'twinOutcome memoized across sub-step ticks',
  o1 === o2 && o1.pathIndex === o2.pathIndex,
  `idx=${o1.pathIndex}`,
)

// APY: first network (or fallback), second must be cache/coalesced
const q1 = await fetchSolendUsdcApy()
const peeked = peekSolendUsdcApy()
const q2 = await fetchSolendUsdcApy()
check('APY first fetch returns a quote', q1.apy > 0, `${(q1.apy * 100).toFixed(2)}% from ${q1.source}`)
check('APY peek hits memory after fetch', !!peeked && peeked.apy === q1.apy)
check(
  'APY second fetch is cache hit',
  q2.source === 'cache' || (q2.source === 'solend' && q2.fetchedAt === q1.fetchedAt),
  `source=${q2.source}`,
)
check('APY TTL is 15 minutes', APY_TTL_MS === 15 * 60 * 1000)

console.log(results.join('\n'))
if (results.some((r) => r.startsWith('FAIL'))) process.exit(1)
