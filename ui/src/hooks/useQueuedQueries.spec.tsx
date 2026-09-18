import { QueryClient, QueryClientProvider, queryOptions } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useQueuedQueries } from '@/hooks/useQueuedQueries'
import { getBatchSizeController } from '@/utils/rateLimit'

const BATCH_INTERVAL = 200

function createWrapper(queryClient: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('useQueuedQueries', () => {
  it('returns results positionally aligned with the input, cached or not', async () => {
    const queryClient = new QueryClient()
    // A fresh entry in the middle is released ahead of its metered neighbours, and used to
    // shift every later result down a slot
    queryClient.setQueryData<string>(['queued', 3], 'value-3')

    const queries = Array.from({ length: 6 }, (_, i) =>
      queryOptions({
        queryKey: ['queued', i],
        queryFn: async () => `value-${i}`,
        staleTime: Infinity,
      }),
    )

    const { result } = renderHook(
      () => useQueuedQueries(queries, { maxBatchSize: 2, batchInterval: BATCH_INTERVAL }),
      { wrapper: createWrapper(queryClient) },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.data).toEqual([
      'value-0',
      'value-1',
      'value-2',
      'value-3',
      'value-4',
      'value-5',
    ])
  })

  it('meters uncached queries out over successive batches', async () => {
    const queryClient = new QueryClient()
    const started: number[] = []

    const queries = Array.from({ length: 5 }, (_, i) =>
      queryOptions({
        queryKey: ['metered', i],
        queryFn: async () => {
          started.push(i)
          return i
        },
      }),
    )

    renderHook(
      () => useQueuedQueries(queries, { maxBatchSize: 2, batchInterval: BATCH_INTERVAL }),
      {
        wrapper: createWrapper(queryClient),
      },
    )

    await waitFor(() => expect(started).toHaveLength(2))
    expect(started).toEqual([0, 1])

    await waitFor(() => expect(started).toHaveLength(5))
    expect(started).toEqual([0, 1, 2, 3, 4])
  })

  it('meters stale cache entries rather than refreshing them all at once', async () => {
    const queryClient = new QueryClient()
    const started: number[] = []

    const queries = Array.from({ length: 3 }, (_, i) =>
      queryOptions({
        queryKey: ['restored', i],
        queryFn: async () => {
          started.push(i)
          return `fresh-${i}`
        },
      }),
    )
    // Stands in for entries rehydrated from the persisted cache: present, but past staleTime
    queries.forEach((_, i) => queryClient.setQueryData<string>(['restored', i], `stale-${i}`))

    renderHook(
      () => useQueuedQueries(queries, { maxBatchSize: 1, batchInterval: BATCH_INTERVAL }),
      {
        wrapper: createWrapper(queryClient),
      },
    )

    await waitFor(() => expect(started).toEqual([0]))
    await waitFor(() => expect(started).toEqual([0, 1, 2]))
  })

  it('backs off the shared host limit when a query comes back rate limited', async () => {
    const queryClient = new QueryClient()
    const controller = getBatchSizeController('nfd')
    const before = controller.current

    const queries = [
      queryOptions({
        queryKey: ['throttled'],
        queryFn: async () => {
          throw Object.assign(new Error('Too Many Requests'), { response: { status: 429 } })
        },
        retry: false,
      }),
    ]

    renderHook(() => useQueuedQueries(queries, { host: 'nfd', batchInterval: BATCH_INTERVAL }), {
      wrapper: createWrapper(queryClient),
    })

    await waitFor(() => expect(controller.current).toBeLessThan(before))
  })

  it('does not raise the host limit on ticks where nothing reached the host', async () => {
    const queryClient = new QueryClient()
    const controller = getBatchSizeController('algod')
    const before = controller.current
    let fetches = 0

    // Disabled by the caller, as validator metrics are until the bulk pool read settles. The
    // queue still meters them out, but the ticks carry no evidence about what the host can take.
    const queries = Array.from({ length: 4 }, (_, i) => ({
      ...queryOptions({
        queryKey: ['idle', i],
        queryFn: async () => {
          fetches += 1
          return i
        },
      }),
      enabled: false,
    }))

    renderHook(
      () =>
        useQueuedQueries(queries, {
          host: 'algod',
          maxBatchSize: 1,
          batchInterval: BATCH_INTERVAL,
        }),
      { wrapper: createWrapper(queryClient) },
    )

    // Long enough for the queue to release all four, i.e. several clean-looking ticks
    await act(() => new Promise((resolve) => setTimeout(resolve, BATCH_INTERVAL * 5)))

    expect(fetches).toBe(0)
    expect(controller.current).toBe(before)
  })

  it('restarts pacing before changed queries become enabled', async () => {
    const queryClient = new QueryClient()
    const started: number[] = []
    const enabledQueries = Array.from({ length: 4 }, (_, i) =>
      queryOptions({
        queryKey: ['enabled-later', i],
        queryFn: async () => {
          started.push(i)
          return i
        },
      }),
    )
    const disabledQueries = enabledQueries.map((query) => ({ ...query, enabled: false }))

    const { rerender } = renderHook(
      ({ enabled }) =>
        useQueuedQueries(enabled ? enabledQueries : disabledQueries, {
          maxBatchSize: 1,
          batchInterval: BATCH_INTERVAL,
        }),
      {
        initialProps: { enabled: false },
        wrapper: createWrapper(queryClient),
      },
    )

    // Let the first queue drain while every query is caller-disabled.
    await act(() => new Promise((resolve) => setTimeout(resolve, BATCH_INTERVAL * 5)))
    expect(started).toEqual([])

    rerender({ enabled: true })

    // The old queue had released all four, but the new generation must start at one again.
    await waitFor(() => expect(started).toEqual([0]))
    await waitFor(() => expect(started).toEqual([0, 1, 2, 3]))
  })

  it('completes immediately when everything is already cached', async () => {
    const queryClient = new QueryClient()
    let fetches = 0

    const queries = Array.from({ length: 3 }, (_, i) =>
      queryOptions({
        queryKey: ['warm', i],
        queryFn: async () => {
          fetches += 1
          return i
        },
        staleTime: Infinity,
      }),
    )
    queries.forEach((_, i) => queryClient.setQueryData<number>(['warm', i], i))

    const { result } = renderHook(
      () => useQueuedQueries(queries, { maxBatchSize: 1, batchInterval: BATCH_INTERVAL }),
      { wrapper: createWrapper(queryClient) },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data).toEqual([0, 1, 2])
    expect(fetches).toBe(0)
  })
})
