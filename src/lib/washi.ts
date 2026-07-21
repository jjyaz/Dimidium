/**
 * The Washi Washi counter. Every mascot poke is a whisper.
 * Nobody knows why. Dimidium will not elaborate.
 */
import { useSyncExternalStore } from 'react'

const KEY = 'dimidium.washi.v1'
const SEED = 1247

function load(): number {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw !== null) {
      const n = Number(raw)
      if (Number.isFinite(n) && n >= 0) return n
    }
  } catch {
    // storage unavailable; whisper in memory only
  }
  return SEED
}

let count = load()
const listeners = new Set<() => void>()

export function incrementWashi() {
  count += 1
  try {
    localStorage.setItem(KEY, String(count))
  } catch {
    // ignore
  }
  listeners.forEach((l) => l())
}

export function useWashiCount(): number {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => count,
  )
}
