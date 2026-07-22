/**
 * Tiny TTL cache with in-flight request coalescing.
 *
 * Used for price-path memoization and Solend APY lookups so incubation
 * screens do not keep re-subscribing / re-fetching the same quotes.
 */

export interface CacheEntry<T> {
  value: T
  expiresAt: number
}

export interface TtlCacheOptions {
  /** Soft TTL — after this, a refresh is preferred. */
  ttlMs: number
  /** Hard ceiling — stale entries past this are dropped. Defaults to 8× ttl. */
  maxAgeMs?: number
}

export class TtlCache<T> {
  private store = new Map<string, CacheEntry<T>>()
  private inflight = new Map<string, Promise<T>>()
  private readonly ttlMs: number
  private readonly maxAgeMs: number

  constructor(opts: TtlCacheOptions) {
    this.ttlMs = opts.ttlMs
    this.maxAgeMs = opts.maxAgeMs ?? opts.ttlMs * 8
  }

  peek(key: string): T | undefined {
    return this.store.get(key)?.value
  }

  set(key: string, value: T, ttlMs = this.ttlMs): T {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs })
    return value
  }

  /** Return a fresh hit, or undefined if missing/stale. */
  getFresh(key: string): T | undefined {
    const hit = this.store.get(key)
    if (!hit) return undefined
    if (Date.now() > hit.expiresAt) return undefined
    return hit.value
  }

  /** Return any value still within the hard max-age window. */
  getStale(key: string): T | undefined {
    const hit = this.store.get(key)
    if (!hit) return undefined
    const stampedAt = hit.expiresAt - this.ttlMs
    if (Date.now() - stampedAt > this.maxAgeMs) {
      this.store.delete(key)
      return undefined
    }
    return hit.value
  }

  /**
   * Coalesce concurrent work for the same key. If a fresh value exists,
   * returns it immediately without calling `loader`.
   */
  async getOrLoad(
    key: string,
    loader: () => Promise<T>,
  ): Promise<{ value: T; fromCache: boolean }> {
    const fresh = this.getFresh(key)
    if (fresh !== undefined) return { value: fresh, fromCache: true }

    const pending = this.inflight.get(key)
    if (pending) return { value: await pending, fromCache: false }

    const work = (async () => {
      try {
        const value = await loader()
        this.set(key, value)
        return value
      } finally {
        this.inflight.delete(key)
      }
    })()

    this.inflight.set(key, work)
    return { value: await work, fromCache: false }
  }

  clear(key?: string) {
    if (key) {
      this.store.delete(key)
      this.inflight.delete(key)
    } else {
      this.store.clear()
      this.inflight.clear()
    }
  }

  size(): number {
    return this.store.size
  }
}

/** Sync memoization for pure deterministic lookups (price paths). */
export class MemoCache<T> {
  private store = new Map<string, T>()
  private readonly maxEntries: number

  constructor(maxEntries = 64) {
    this.maxEntries = maxEntries
  }

  getOrCompute(key: string, compute: () => T): T {
    const hit = this.store.get(key)
    if (hit !== undefined) {
      // refresh insertion order for a crude LRU
      this.store.delete(key)
      this.store.set(key, hit)
      return hit
    }
    const value = compute()
    this.store.set(key, value)
    if (this.store.size > this.maxEntries) {
      const oldest = this.store.keys().next().value
      if (oldest !== undefined) this.store.delete(oldest)
    }
    return value
  }

  clear() {
    this.store.clear()
  }
}
