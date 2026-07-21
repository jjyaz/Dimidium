import type { DecisionState } from '../lib/types'

const LABELS: Record<DecisionState, string> = {
  incubating: 'Incubating',
  ready: 'Ready to hatch',
  hatched: 'Hatched',
  shelled: 'Returned to shell',
}

export function StatusPill({ state }: { state: DecisionState }) {
  return (
    <span className={`status-pill status-${state}`}>{LABELS[state]}</span>
  )
}
