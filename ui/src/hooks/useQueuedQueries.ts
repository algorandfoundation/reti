import {
  useQueries,
  UseQueryOptions,
  QueryKey,
  UseQueryResult,
  useQueryClient,
} from '@tanstack/react-query'
import * as React from 'react'
import { getBatchSizeController, isRateLimitError, RateLimitedHost } from '@/utils/rateLimit'

const DEFAULT_BATCH_SIZE = 8
const DEFAULT_BATCH_INTERVAL = 1000

function combineResults<TData, TError>(results: UseQueryResult<TData, TError>[]) {
  return {
    data: results.map((r) => r.data),
    isFetching: results.some((r) => r.isFetching),
    isLoading: results.some((r) => r.isLoading),
    isError: results.some((r) => r.isError),
    error: results.find((r) => r.error)?.error,
    rateLimitedCount: results.reduce(
      (count, r) => (isRateLimitError(r.error) ? count + 1 : count),
      0,
    ),
  }
}

export interface UseQueuedQueriesOptions {
  /**
   * Upstream service these queries hit. Batch size is then learned and backed off per host,
   * so a rate limited service throttles only its own traffic.
   */
  host?: RateLimitedHost
  /** Ceiling for this call site, applied on top of whatever the host has learned. */
  maxBatchSize?: number
  batchInterval?: number
}

/**
 * Fetches queries in batches on an interval to prevent overwhelming the upstream service.
 *
 * Results are returned positionally aligned with the input array - entries not yet released
 * (or still in flight) read as `undefined` rather than shifting their neighbours.
 *
 * IMPORTANT: Queries must be memoized to avoid infinite loops.
 * @param queries - Array of memoized query options
 * @param options - Host to meter against, plus optional batch size ceiling and interval
 */
export function useQueuedQueries<
  TQueryFnData = unknown,
  TError = unknown,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(
  queries: UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>[],
  {
    host,
    maxBatchSize = DEFAULT_BATCH_SIZE,
    batchInterval = DEFAULT_BATCH_INTERVAL,
  }: UseQueuedQueriesOptions = {},
) {
  const queryClient = useQueryClient()
  const controller = React.useMemo(() => (host ? getBatchSizeController(host) : null), [host])

  const nextBatchSize = React.useCallback(
    () => Math.max(1, Math.min(controller?.current ?? DEFAULT_BATCH_SIZE, maxBatchSize)),
    [controller, maxBatchSize],
  )

  // Only work that will actually hit the network is metered out; anything already holding
  // fresh data is released straight away. Freshness rather than mere presence matters because
  // entries restored from the persisted cache arrive with data but may well be stale.
  const pending = React.useMemo(
    () =>
      queries.reduce<number[]>((indexes, query, index) => {
        const state = queryClient.getQueryState(query.queryKey!)
        const staleTime = typeof query.staleTime === 'number' ? query.staleTime : 0
        const isFresh = state?.data !== undefined && Date.now() - state.dataUpdatedAt < staleTime

        if (!isFresh) {
          indexes.push(index)
        }
        return indexes
      }, []),
    [queries, queryClient],
  )

  // Keep progress tied to the exact pending set it was calculated for. Effects run after
  // render, so a plain counter would briefly release a new query set using the previous set's
  // progress (potentially all of it) before the reset effect gets a chance to run.
  const [queueState, setQueueState] = React.useState(() => ({
    pending,
    released: 0,
    isComplete: pending.length === 0,
  }))
  const isCurrentQueue = queueState.pending === pending
  const released = isCurrentQueue ? queueState.released : 0
  const isComplete = pending.length === 0 || (isCurrentQueue && queueState.isComplete)

  // Whether anything was rate limited since the last tick, and whether the batch just released
  // actually put requests on the wire. Held in refs so the interval can read them without being
  // torn down and restarted on every result change.
  const throttledSinceTickRef = React.useRef(false)
  const didFetchSinceTickRef = React.useRef(false)

  React.useEffect(() => {
    if (pending.length === 0) {
      setQueueState({ pending, released: 0, isComplete: true })
      return
    }

    let count = Math.min(pending.length, nextBatchSize())
    setQueueState({
      pending,
      released: count,
      isComplete: count >= pending.length,
    })

    if (count >= pending.length) {
      return
    }

    const timer = setInterval(() => {
      // Only a batch that actually reached the host says anything about it. Ticks where every
      // released query was disabled by the caller, or was answered from cache, carry no
      // evidence - counting those as clean would ramp the shared per-host limit on no traffic.
      // Backoff has already been applied by the effect below; this is the increase half.
      if (didFetchSinceTickRef.current && !throttledSinceTickRef.current) {
        controller?.recordClean()
      }
      throttledSinceTickRef.current = false
      didFetchSinceTickRef.current = false

      count = Math.min(pending.length, count + nextBatchSize())
      setQueueState({
        pending,
        released: count,
        isComplete: count >= pending.length,
      })

      if (count >= pending.length) {
        clearInterval(timer)
      }
    }, batchInterval)

    return () => clearInterval(timer)
  }, [pending, nextBatchSize, batchInterval, controller])

  const gatedQueries = React.useMemo(() => {
    const gated = new Set(pending.slice(released))
    return queries.map((query, index) => (gated.has(index) ? { ...query, enabled: false } : query))
  }, [queries, pending, released])

  const results = useQueries({
    queries: gatedQueries,
    combine: combineResults,
  })

  const { isFetching, rateLimitedCount } = results
  const rateLimitedRef = React.useRef(0)

  React.useEffect(() => {
    if (isFetching) {
      didFetchSinceTickRef.current = true
    }
  }, [isFetching])

  React.useEffect(() => {
    // Only a rise counts as a signal - the tally also drops when the query set is rebuilt,
    // which says nothing about the host. Back off straight away rather than at the next tick,
    // and record it so that tick doesn't read the absence of a *further* rise as clean.
    if (rateLimitedCount > rateLimitedRef.current) {
      throttledSinceTickRef.current = true
      controller?.recordThrottled()
    }
    rateLimitedRef.current = rateLimitedCount
  }, [controller, rateLimitedCount])

  // Override isLoading so consumers keep seeing a loading state until the queue drains
  return React.useMemo(
    () => ({
      ...results,
      isLoading: !isComplete || results.isLoading,
    }),
    [results, isComplete],
  )
}
