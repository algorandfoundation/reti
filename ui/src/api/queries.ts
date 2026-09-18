import { AlgoAmount } from '@algorandfoundation/algokit-utils/types/amount'
import { keepPreviousData, QueryClient, queryOptions } from '@tanstack/react-query'
import algosdk from 'algosdk'
import { AxiosError } from 'axios'
import { CacheRequestConfig } from 'axios-cache-interceptor'
import { fetchAsset, fetchAssetHoldings, fetchBalance, fetchBlockTimes } from '@/api/algod'
import {
  fetchAllValidatorData,
  fetchMbrAmounts,
  fetchPoolApy,
  fetchPoolGlobalState,
  fetchPoolGlobalStates,
  fetchProtocolConstraints,
  fetchStakedInfoForPool,
  fetchStakerValidatorData,
  fetchValidatorConfig,
  fetchValidatorNodePoolAssignments,
  fetchValidatorPools,
  fetchValidatorState,
  processPoolData,
} from '@/api/contracts'
import { algorandClient } from '@/api/clients'
import { fetchNfd, fetchNfdReverseLookup } from '@/api/nfd'
import { Nfd, NfdGetLookupParams, NfdGetNFDParams } from '@/interfaces/nfd'
import { LocalPoolInfo, PoolGlobalState } from '@/interfaces/validator'
import { calculateValidatorPoolMetrics, seedValidatorCoreQueries } from '@/utils/contracts'
import { resolveIpfsUrl } from '@/utils/ipfs'
import { fetchNodely24hPerf } from '@/api/nodely'

////////////////////////////////////////////////////////////
// Core protocol data queries
////////////////////////////////////////////////////////////

/** How often the whole validator set is re-read. One request, so this can be tight. */
const ALL_VALIDATORS_REFETCH_INTERVAL = 1000 * 30 // 30 seconds

/**
 * How long persisted queries stay resident. Must outlive the persister's `maxAge`: an entry
 * that gets garbage collected is dropped from the next dehydrate, which would quietly evict
 * it from storage too.
 */
const PERSISTED_GC_TIME = 1000 * 60 * 60 * 24 // 24 hours

/**
 * Every validator's config, state, pools and node/pool assignments in a single request.
 *
 * Seeding happens inside the queryFn rather than an effect so the per-validator caches are
 * populated before this promise resolves - anything awaiting it sees a consistent world.
 */
export const allValidatorsQueryOptions = (queryClient: QueryClient) =>
  queryOptions({
    queryKey: ['all-validators'],
    queryFn: async () => {
      const validators = await fetchAllValidatorData()
      seedValidatorCoreQueries(queryClient, validators)
      return validators
    },
    staleTime: ALL_VALIDATORS_REFETCH_INTERVAL,
    gcTime: PERSISTED_GC_TIME,
    refetchInterval: ALL_VALIDATORS_REFETCH_INTERVAL,
    refetchIntervalInBackground: false,
  })

export const mbrQueryOptions = queryOptions({
  queryKey: ['mbr'],
  queryFn: () => fetchMbrAmounts(),
  staleTime: Infinity,
})

export const constraintsQueryOptions = queryOptions({
  queryKey: ['constraints'],
  queryFn: () => fetchProtocolConstraints(),
  staleTime: 1000 * 60 * 60, // 1 hour
})

////////////////////////////////////////////////////////////
// Validator data queries
////////////////////////////////////////////////////////////

/**
 * Keep seeded per-validator entries around longer than the 5 minute default, so navigating
 * dashboard -> detail -> back -> detail keeps resolving from cache.
 */
const VALIDATOR_GC_TIME = 1000 * 60 * 10 // 10 minutes

export const validatorConfigQueryOptions = (validatorId: number) =>
  queryOptions({
    queryKey: ['validator-config', String(validatorId)],
    queryFn: () => fetchValidatorConfig(validatorId),
    staleTime: Infinity,
    gcTime: VALIDATOR_GC_TIME,
    refetchInterval: 1000 * 60 * 60 * 2, // 2 hours
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })

export const validatorStateQueryOptions = (
  validatorId: number,
  refetchInterval = 1000 * 30, // 30 seconds
  refetchOnWindowFocus = true,
) =>
  queryOptions({
    queryKey: ['validator-state', String(validatorId)],
    queryFn: () => fetchValidatorState(validatorId),
    gcTime: VALIDATOR_GC_TIME,
    refetchInterval,
    refetchOnWindowFocus,
    refetchOnMount: false,
  })

export const validatorPoolsQueryOptions = (
  validatorId: number,
  refetchInterval = 1000 * 30, // 30 seconds
  refetchOnWindowFocus = true,
) =>
  queryOptions({
    queryKey: ['validator-pools', String(validatorId)],
    queryFn: () => fetchValidatorPools(validatorId),
    gcTime: VALIDATOR_GC_TIME,
    refetchInterval,
    refetchOnWindowFocus,
    refetchOnMount: false,
  })

export const validatorNodePoolAssignmentsQueryOptions = (validatorId: number, enabled = true) =>
  queryOptions({
    queryKey: ['validator-node-pool-assignments', String(validatorId)],
    queryFn: () => fetchValidatorNodePoolAssignments(validatorId),
    staleTime: Infinity,
    gcTime: VALIDATOR_GC_TIME,
    refetchInterval: 1000 * 60 * 60 * 2, // 2 hours
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    enabled,
  })

/** Metrics and the bulk inputs they read expire together. */
const METRICS_STALE_TIME = 1000 * 60 * 30 // 30 minutes

/** Keep mounted pool details current as node daemons report new versions. */
const POOL_GLOBAL_STATES_REFETCH_INTERVAL = 1000 * 30 // 30 seconds

/**
 * Every pool's global state in one request, shared by every validator's metrics.
 *
 * Reading `lastPayout` per pool used to be one call each - 283 of the 849 requests the
 * dashboard made. All pools are created by the registry's app account, so a single
 * `accountInformation` read on it returns the lot.
 */
export const poolGlobalStatesQueryOptions = queryOptions({
  queryKey: ['pool-global-states'],
  queryFn: () => fetchPoolGlobalStates(),
  staleTime: METRICS_STALE_TIME,
  gcTime: PERSISTED_GC_TIME,
  refetchInterval: POOL_GLOBAL_STATES_REFETCH_INTERVAL,
  refetchOnWindowFocus: false,
})

/**
 * One pool's global state, for recovering a pool the bulk read above didn't carry - algod caps
 * the resources it returns per account, and the request can fail outright. Callers gate this on
 * `isPoolGlobalStateComplete`, so on the normal path it never runs.
 */
export const poolGlobalStateQueryOptions = (poolAppId: bigint) =>
  queryOptions({
    queryKey: ['pool-global-state', String(poolAppId)],
    queryFn: () => fetchPoolGlobalState(poolAppId),
    enabled: !!poolAppId,
    staleTime: METRICS_STALE_TIME,
    refetchInterval: POOL_GLOBAL_STATES_REFETCH_INTERVAL,
    refetchOnWindowFocus: false,
  })

const NO_POOL_GLOBAL_STATES: ReadonlyMap<bigint, PoolGlobalState> = new Map()

export interface ValidatorMetricsInput {
  pools: LocalPoolInfo[]
  totalAlgoStaked: bigint
  epochRoundLength: number
}

/**
 * Per-validator inputs are passed in rather than pulled from the per-validator caches. Reading
 * them via `ensureQueryData` would silently refetch once those entries are garbage collected,
 * which happens as soon as nothing observes them.
 *
 * The bulk pool state is deliberately *not* an input: the query key is the validator id alone,
 * and every observer of a key writes its own options onto the shared query on every render, so
 * whichever one rendered last supplies the `queryFn` for any fetch it didn't itself initiate
 * (`refetchQueries`, for instance). Passing it in would let a row's read-only observer install a
 * `queryFn` closed over an empty map and quietly degrade a later refetch into one request per
 * pool. Reading it from the cache here - a lookup, never a fetch - keeps every observer's
 * options equivalent.
 */
export const validatorMetricsQueryOptions = (
  validatorId: number,
  queryClient: QueryClient,
  { pools, totalAlgoStaked, epochRoundLength }: ValidatorMetricsInput,
) =>
  queryOptions({
    queryKey: ['validator-metrics', String(validatorId)],
    queryFn: async () => {
      const poolGlobalStates =
        queryClient.getQueryData(poolGlobalStatesQueryOptions.queryKey) ?? NO_POOL_GLOBAL_STATES

      const params = await algorandClient.getSuggestedParams()
      const poolDataPromises = pools.map((pool) =>
        processPoolData(pool, poolGlobalStates.get(pool.poolAppId)),
      )
      const processedPoolsData = await Promise.all(poolDataPromises)

      // Ignore pools with less than 30k ALGO balance
      const filteredPoolsData = processedPoolsData.filter(
        (pool) => pool.balance >= AlgoAmount.Algos(30_000).microAlgos,
      )

      return calculateValidatorPoolMetrics(
        filteredPoolsData,
        totalAlgoStaked,
        BigInt(epochRoundLength),
        BigInt(params.firstValid),
      )
    },
    staleTime: METRICS_STALE_TIME,
    gcTime: PERSISTED_GC_TIME,
    refetchOnWindowFocus: false,
    // Left at the default so metrics restored from the persisted cache are refreshed once they
    // pass their staleTime. The queue in useValidators meters that refresh.
  })

////////////////////////////////////////////////////////////
// Staking data queries
////////////////////////////////////////////////////////////

export const stakedInfoQueryOptions = (poolAppId: bigint) =>
  queryOptions({
    queryKey: ['staked-info', poolAppId.toString()],
    queryFn: () => fetchStakedInfoForPool(poolAppId),
    enabled: !!poolAppId,
  })

export const stakesQueryOptions = (staker: string | null) =>
  queryOptions({
    queryKey: ['stakes', { staker }],
    queryFn: () => fetchStakerValidatorData(staker!),
    enabled: !!staker,
    retry: false,
    refetchInterval: 1000 * 60, // 1 minute
  })

////////////////////////////////////////////////////////////
// NFD queries
////////////////////////////////////////////////////////////

/**
 * NFD records are near-static and the API is rate limited, so they are cached hard: an hour
 * before a refetch is even considered, a day before the entry is dropped. These keys are also
 * persisted to IndexedDB (see `@/lib/queryPersister`), and `axiosNfdApi` keeps its own
 * persisted HTTP cache underneath, so a reload paints names and avatars without a request.
 */
const NFD_STALE_TIME = 1000 * 60 * 60 // 1 hour

/** Applied when a caller has opted out of the HTTP cache, i.e. asked for fresh data. */
const NFD_VOLATILE_STALE_TIME = 1000 * 60 * 5 // 5 minutes

/**
 * Retries are owned by `axiosNfdApi`, which backs off exponentially on 429s. Layering the
 * react-query retry on top would multiply out to dozens of attempts per record.
 */
const nfdRetry = false

export const nfdQueryOptions = (
  nameOrId: string | number | bigint,
  params: NfdGetNFDParams = { view: 'brief' },
  options: CacheRequestConfig = {},
) =>
  queryOptions<Nfd>({
    queryKey: ['nfd', nameOrId.toString(), params],
    queryFn: () => fetchNfd(nameOrId.toString(), params, options),
    enabled: !!nameOrId,
    placeholderData: keepPreviousData,
    staleTime: NFD_STALE_TIME,
    gcTime: PERSISTED_GC_TIME,
    retry: nfdRetry,
    refetchOnWindowFocus: false,
    // Left at the default: a restored record older than an hour is refreshed, and the axios
    // cache underneath usually answers that without a request anyway.
  })

export const nfdLookupQueryOptions = (
  address: string | null,
  params: Omit<NfdGetLookupParams, 'address'> = { view: 'thumbnail' },
  options: CacheRequestConfig = {},
) => {
  // Reverse lookups follow whichever address currently holds the NFD, and a caller passing
  // `cache: false` has said it cares about that. Don't cache those hard behind its back.
  const isNearStatic = options.cache !== false

  return queryOptions<Nfd | null, AxiosError>({
    queryKey: ['nfd-lookup', address, params],
    queryFn: () => fetchNfdReverseLookup(String(address), params, options),
    enabled: !!address,
    staleTime: isNearStatic ? NFD_STALE_TIME : NFD_VOLATILE_STALE_TIME,
    gcTime: PERSISTED_GC_TIME,
    retry: nfdRetry,
    refetchOnWindowFocus: false,
  })
}

////////////////////////////////////////////////////////////
// Asset queries
////////////////////////////////////////////////////////////

export const assetQueryOptions = (assetId: number) =>
  queryOptions<algosdk.modelsv2.Asset>({
    queryKey: ['asset', assetId],
    queryFn: () => fetchAsset(assetId),
    staleTime: Infinity,
    enabled: assetId > 0,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })

////////////////////////////////////////////////////////////
// Account queries
////////////////////////////////////////////////////////////

export const balanceQueryOptions = (address: string | null) =>
  queryOptions({
    queryKey: ['account-balance', address],
    queryFn: () => fetchBalance(address),
    enabled: !!address,
    refetchInterval: 1000 * 30, // Every 30 seconds
  })

export const assetHoldingQueryOptions = (address: string | null) =>
  queryOptions({
    queryKey: ['asset-holdings', address],
    queryFn: () => fetchAssetHoldings(address),
    enabled: !!address,
    refetchInterval: 1000 * 60 * 2, // Every 2 minutes
  })

////////////////////////////////////////////////////////////
// IPFS queries
////////////////////////////////////////////////////////////

export const ipfsUrlQueryOptions = (ipfsUrl: string) =>
  queryOptions({
    queryKey: ['ipfs-url', ipfsUrl],
    queryFn: () => resolveIpfsUrl(ipfsUrl),
    enabled: ipfsUrl.startsWith('ipfs://'),
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24, // 24 hours
    retry: (failureCount) => failureCount < 2,
  })

////////////////////////////////////////////////////////////
// Miscellaneous queries
////////////////////////////////////////////////////////////

export const blockTimeQueryOptions = queryOptions({
  queryKey: ['block-times'],
  queryFn: () => fetchBlockTimes(),
  staleTime: 1000 * 60 * 30, // 30 mins
})

export const poolApyQueryOptions = (poolAppId: bigint, staleTime?: number) =>
  queryOptions({
    queryKey: ['pool-apy', poolAppId.toString()],
    queryFn: () => fetchPoolApy(poolAppId),
    enabled: !!poolAppId,
    staleTime: staleTime || 1000 * 60 * 60, // 1 hour
  })

////////////////////////////////////////////////////////////
// Nodely queries
////////////////////////////////////////////////////////////
export const nodelyPerfMetricsQueryOptions = () =>
  queryOptions({
    queryKey: ['nodely-perf'],
    queryFn: () => fetchNodely24hPerf(),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 30, // 30 mins
    retry: (failureCount, error) => {
      if (error instanceof AxiosError) {
        return error.response?.status !== 404 && failureCount < 3
      }
      return false
    },
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })
