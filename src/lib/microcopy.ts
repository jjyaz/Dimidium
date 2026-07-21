export const MASCOT_LINES = [
  'Are we sure?',
  'Maybe sleep on it?',
  'Boop.',
  'Other half checking in.',
  'I have seen things. Mostly candles.',
  'No rush. I am an egg.',
  'Washi washi.',
] as const

export const INCUBATING_LINES = [
  'Your other half is thinking.',
  'Do not tap the egg. It is concentrating.',
  'Still incubating. Very mysterious.',
  'A thought occurred. No promises.',
] as const

export const SHELLED_LINES = [
  'You chose not to chase it.',
  'The shell supports this decision.',
] as const

export const HATCHED_LINES = [
  'It hatched. Deep breath.',
  'Past you has left future you a note.',
] as const

export function randomLine<T>(lines: readonly T[], seed?: number): T {
  const i =
    seed !== undefined
      ? Math.abs(seed) % lines.length
      : Math.floor(Math.random() * lines.length)
  return lines[i]
}

export function stateLine(state: string, seed: number): string {
  if (state === 'hatched') return randomLine(HATCHED_LINES, seed)
  if (state === 'shelled') return randomLine(SHELLED_LINES, seed)
  if (state === 'ready') return 'A thought occurred. No promises.'
  return randomLine(INCUBATING_LINES, seed)
}
