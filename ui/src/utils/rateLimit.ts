/**
 * Upstreams the dashboard fans out to. Limits are learned per host because they are separate
 * services with separate budgets - a 429 from NFD says nothing about what algod can take.
 *
 * Nodely is not listed: the only queue that touches it is validator metrics, and
 * `fetchNodelyVotingPerf` swallows its failures, so no Nodely rate limiting ever reaches a
 * query result to learn from.
 */
export type RateLimitedHost = 'algod' | 'nfd'

interface HostLimits {
  /** Floor. Must be >= 1 so the queue can never converge to a stall. */
  min: number
  max: number
  /** Used on a cold start, and as the clamp target for anything read back from storage. */
  initial: number
}

/**
 * Ranges are per batch tick (one second). `algod` is shared by the metrics and asset queues,
 * whose batches cost very different numbers of requests, so its ceiling is set for the
 * expensive one (metrics: up to a few dozen requests per validator).
 */
const HOST_LIMITS: Record<RateLimitedHost, HostLimits> = {
  algod: { min: 2, max: 8, initial: 4 },
  nfd: { min: 2, max: 12, initial: 6 },
}

/** Clean batch ticks required before probing one step higher. */
const CLEAN_TICKS_PER_INCREASE = 2

const STORAGE_PREFIX = 'reti-batch-size:'

const RATE_LIMIT_STATUSES = new Set([429, 503])

/**
 * Rate limiting reaches us in three shapes: an `AxiosError` (NFD, Nodely), an algosdk client
 * error carrying a bare `status`, and - when a fetch layer flattens it - a message string.
 */
export function isRateLimitError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false
  }

  const candidate = error as {
    status?: unknown
    response?: { status?: unknown } | null
    message?: unknown
  }

  const status =
    typeof candidate.status === 'number' ? candidate.status : candidate.response?.status

  if (typeof status === 'number' && RATE_LIMIT_STATUSES.has(status)) {
    return true
  }

  return (
    typeof candidate.message === 'string' &&
    /\b(429|503|too many requests)\b/i.test(candidate.message)
  )
}

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Storage is a nicety here; a fresh probe every load is an acceptable fallback
  }
}

/**
 * AIMD controller over a queue's batch size: additive increase while batches land cleanly,
 * multiplicative decrease the moment one is rate limited.
 *
 * The learned value is persisted so the next page load starts near the rate this client
 * already knows the host will take, rather than rediscovering it from scratch. It is only a
 * starting point - additive increase re-probes upward every load, so a value learned during a
 * bad minute can't pin the client low forever.
 */
export class AdaptiveBatchSize {
  private readonly limits: HostLimits
  private readonly storageKey: string
  private cleanTicks = 0
  private value: number

  constructor(private readonly host: RateLimitedHost) {
    this.limits = HOST_LIMITS[host]
    this.storageKey = `${STORAGE_PREFIX}${host}`
    this.value = this.restore()
  }

  get current(): number {
    return this.value
  }

  /** A batch tick completed with no new rate limiting. */
  recordClean(): void {
    this.cleanTicks += 1
    if (this.cleanTicks < CLEAN_TICKS_PER_INCREASE) {
      return
    }
    this.cleanTicks = 0
    this.set(this.value + 1, 'increase')
  }

  /** A query in the last batch came back rate limited. */
  recordThrottled(): void {
    this.cleanTicks = 0
    this.set(Math.floor(this.value / 2), 'backoff')
  }

  private restore(): number {
    const stored = Number(readStorage(this.storageKey))
    return Number.isFinite(stored) && stored > 0 ? this.clamp(stored) : this.limits.initial
  }

  private clamp(value: number): number {
    return Math.min(this.limits.max, Math.max(this.limits.min, Math.round(value)))
  }

  private set(next: number, reason: 'increase' | 'backoff'): void {
    const clamped = this.clamp(next)
    if (clamped === this.value) {
      return
    }
    this.value = clamped
    writeStorage(this.storageKey, String(clamped))
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.debug(`[rate-limit] ${this.host} batch size ${reason} -> ${clamped}`)
    }
  }
}

const controllers = new Map<RateLimitedHost, AdaptiveBatchSize>()

/** Controllers are per host and shared across call sites, so backoff applies to the service. */
export function getBatchSizeController(host: RateLimitedHost): AdaptiveBatchSize {
  let controller = controllers.get(host)
  if (!controller) {
    controller = new AdaptiveBatchSize(host)
    controllers.set(host, controller)
  }
  return controller
}
