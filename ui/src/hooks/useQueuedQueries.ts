import {
  useQueries,
  UseQueryOptions,
  QueryKey,
  UseQueryResult,
  useQueryClient,
} from '@tanstack/react-query'
import * as React from 'react'

const DEFAULT_BATCH_SIZE = 8
const DEFAULT_BATCH_INTERVAL = 1000

function combineResults<TData, TError>(results: UseQueryResult<TData, TError>[]) {
  return {
    data: results.map((r) => r.data),
    isFetching: results.some((r) => r.isFetching),
    isLoading: results.some((r) => r.isLoading),
    isError: results.some((r) => r.isError),
    error: results.find((r) => r.error)?.error,
  }
}

/**
 * Fetches queries in batches on an interval to prevent overwhelming the node.
 * IMPORTANT: Queries must be memoized to avoid infinite loops.
 * @param queries - Array of memoized query options
 * @param batchSize - Number of queries to fetch in each batch (default: 8)
 * @param batchInterval - Time in milliseconds to wait between batches (default: 1000)
 */
export function useQueuedQueries<
  TQueryFnData = unknown,
  TError = unknown,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(
  queries: UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>[],
  batchSize: number = DEFAULT_BATCH_SIZE,
  batchInterval: number = DEFAULT_BATCH_INTERVAL,
) {
  const queryClient = useQueryClient()
  const [activeQueries, setActiveQueries] = React.useState<typeof queries>([])
  const [isComplete, setIsComplete] = React.useState(false)

  React.useEffect(() => {
    // Reset complete state when queries change
    setIsComplete(false)

    // Check which queries already have cached data
    const initialQueries = queries.filter((query) => {
      return queryClient.getQueryData(query.queryKey!) !== undefined
    })

    // Start with cached queries plus first batch of uncached queries
    const uncachedQueries = queries.filter((query) => {
      return queryClient.getQueryData(query.queryKey!) === undefined
    })

    setActiveQueries([...initialQueries, ...uncachedQueries.slice(0, batchSize)])

    // Add new batches of uncached queries on interval
    const timer = setInterval(() => {
      setActiveQueries((prev) => {
        const nextBatchStart = prev.length
        if (nextBatchStart >= queries.length) {
          clearInterval(timer)
          setIsComplete(true)
          return prev
        }
        return [...prev, ...queries.slice(nextBatchStart, nextBatchStart + batchSize)]
      })
    }, batchInterval)

    return () => clearInterval(timer)
  }, [queries, batchSize, batchInterval, queryClient])

  const results = useQueries({
    queries: activeQueries,
    combine: combineResults,
  })

  // Pad results with placeholder queries and override isLoading
  return React.useMemo(
    () => ({
      ...results,
      data: Array.from({ length: queries.length }, (_, i) => results.data[i] ?? undefined),
      isLoading: !isComplete || results.isLoading,
    }),
    [results, queries.length, isComplete],
  )
}
