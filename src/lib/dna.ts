/**
 * Decision DNA — behavioral traits derived from the user's eggs.
 * Not a score. A portrait.
 */
import type { Decision, FragmentDef } from './types'
import { liveState } from './types'
import { twinOutcome } from './prices'

export interface Trait {
  id: string
  name: string
  /** 0..1 */
  value: number
  line: string
}

const clamp = (n: number) => Math.min(1, Math.max(0.08, n))

export function computeTraits(decisions: Decision[]): Trait[] {
  const resolved = decisions.filter((d) => d.resolution)
  const total = decisions.length || 1

  // Patience: how much of each incubation actually elapsed before resolving.
  const patienceSamples = resolved.map((d) => {
    const waited = (d.resolvedAt ?? d.hatchesAt) - d.createdAt
    return Math.min(waited / Math.max(d.incubationMs, 1), 1.4) / 1.4
  })
  const patience =
    patienceSamples.length > 0
      ? patienceSamples.reduce((a, b) => a + b, 0) / patienceSamples.length
      : 0.45

  // Conviction: share of decisions that were eventually hatched.
  const hatched = resolved.filter((d) => d.resolution === 'hatched').length
  const conviction =
    resolved.length > 0 ? hatched / resolved.length : 0.4

  // Plan adherence: resolved without asking for extra time.
  const noExtensions = decisions.filter((d) => d.extensions === 0).length
  const adherence = noExtensions / total

  // Curiosity: variety of assets and intentions explored.
  const assets = new Set(decisions.map((d) => d.asset)).size
  const intents = new Set(decisions.map((d) => d.intention)).size
  const curiosity = (assets / 4 + intents / 4) / 2

  // Volatility response: staying shelled when the simulated market moved hard.
  const volSamples = resolved.map((d) => {
    const move = Math.abs(twinOutcome(d, d.resolvedAt).movePct)
    const stayedCalm = d.resolution === 'shelled' || d.extensions > 0
    return move > 2 ? (stayedCalm ? 1 : 0.3) : 0.6
  })
  const volatility =
    volSamples.length > 0
      ? volSamples.reduce((a, b) => a + b, 0) / volSamples.length
      : 0.5

  return [
    {
      id: 'patience',
      name: 'Patience',
      value: clamp(patience),
      line: 'How long you let a thought sit before touching it.',
    },
    {
      id: 'conviction',
      name: 'Conviction',
      value: clamp(conviction),
      line: 'When the timer ends, do you still mean it?',
    },
    {
      id: 'adherence',
      name: 'Plan adherence',
      value: clamp(adherence),
      line: 'Following the rule that past you wrote down.',
    },
    {
      id: 'curiosity',
      name: 'Curiosity',
      value: clamp(curiosity),
      line: 'The range of things you bring to the shell.',
    },
    {
      id: 'volatility',
      name: 'Volatility response',
      value: clamp(volatility),
      line: 'What you do when the line gets loud.',
    },
  ]
}

export const FRAGMENTS: FragmentDef[] = [
  {
    id: 'slept-on-it',
    name: 'Slept On It',
    line: 'Let a decision incubate for a full 24 hours.',
    earned: (ds) =>
      ds.some(
        (d) =>
          d.resolution &&
          (d.resolvedAt ?? 0) - d.createdAt >= 24 * 60 * 60 * 1000,
      ),
  },
  {
    id: 'ignored-the-noise',
    name: 'Ignored the Noise',
    line: 'Stayed shelled while the simulated market moved more than 2%.',
    earned: (ds) =>
      ds.some(
        (d) =>
          d.resolution === 'shelled' &&
          Math.abs(twinOutcome(d, d.resolvedAt).movePct) > 2,
      ),
  },
  {
    id: 'changed-my-mind',
    name: 'Changed My Mind',
    line: 'Returned a decision to the shell instead of hatching it.',
    earned: (ds) => ds.some((d) => d.resolution === 'shelled'),
  },
  {
    id: 'stayed-with-the-plan',
    name: 'Stayed With the Plan',
    line: 'Resolved a decision without asking for more time.',
    earned: (ds) => ds.some((d) => d.resolution && d.extensions === 0),
  },
  {
    id: 'asked-future-me',
    name: 'Asked Future Me',
    line: 'Left a note for the person who has to decide later.',
    earned: (ds) => ds.some((d) => d.note.trim().length > 0),
  },
  {
    id: 'first-hatch',
    name: 'First Hatch',
    line: 'Hatched your very first decision.',
    earned: (ds) => ds.some((d) => d.resolution === 'hatched'),
  },
]

export function nurseryCounts(decisions: Decision[]) {
  const now = Date.now()
  return {
    all: decisions.length,
    incubating: decisions.filter((d) => liveState(d, now) === 'incubating')
      .length,
    ready: decisions.filter((d) => liveState(d, now) === 'ready').length,
    hatched: decisions.filter((d) => liveState(d, now) === 'hatched').length,
    shelled: decisions.filter((d) => liveState(d, now) === 'shelled').length,
  }
}
