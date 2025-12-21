import {
  fetchAsset,
  fetchAssetHoldings,
  fetchAssets,
  fetchBalance,
  fetchBlockTimes,
} from '@/api/algod'
import { algorandClient } from '@/api/clients'
import {
  fetchMbrAmountsAndProtocolContraints,
  fetchNumValidators,
  fetchPoolApy,
  fetchPoolBalancesAndLastPayouts,
  fetchSingleValidatorInfo,
  fetchStakedInfoForPool,
  fetchStakerValidatorData,
  fetchValidatorConfig as fetchValidatorConfigs,
  fetchValidatorNodePoolAssignments,
  fetchValidatorsInfo,
  fetchValidatorsPools,
  fetchValidatorStates,
  processPoolData,
} from '@/api/contracts'
import { fetchNfd, fetchNfdReverseLookup } from '@/api/nfd'
import { fetchNodely24hPerf } from '@/api/nodely'
import { Asset } from '@/interfaces/asset'
import { Nfd, NfdGetLookupParams, NfdGetNFDParams } from '@/interfaces/nfd'
import { calculateValidatorPoolMetrics } from '@/utils/contracts'
import { resolveIpfsUrl } from '@/utils/ipfs'
import { AlgoAmount } from '@algorandfoundation/algokit-utils/types/amount'
import { keepPreviousData, QueryClient, queryOptions } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { CacheRequestConfig } from 'axios-cache-interceptor'

////////////////////////////////////////////////////////////
// Core protocol data queries
////////////////////////////////////////////////////////////

export const numValidatorsQueryOptions = queryOptions({
  queryKey: ['num-validators'],
  queryFn: fetchNumValidators,
  staleTime: 1000 * 60, // 1 minute
})

export const mbrAndProtocolConstraintsQueryOptions = queryOptions({
  queryKey: ['mbr'],
  queryFn: () => fetchMbrAmountsAndProtocolContraints(),
  staleTime: Infinity,
})

////////////////////////////////////////////////////////////
// Validator data queries
////////////////////////////////////////////////////////////

export const validatorConfigsQueryOptions = (validatorIds: number[]) =>
  queryOptions({
    queryKey: ['validator-config', validatorIds.join(',')],
    queryFn: () => fetchValidatorConfigs(validatorIds),
    staleTime: Infinity,
    refetchInterval: 1000 * 60 * 60 * 2, // 2 hours
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })

export const validatorStatesQueryOptions = (
  validatorIds: number[],
  refetchInterval = 1000 * 30, // 30 seconds
  refetchOnWindowFocus = true,
) =>
  queryOptions({
    queryKey: ['validator-state', validatorIds.join(',')],
    queryFn: () => fetchValidatorStates(validatorIds),
    refetchInterval,
    refetchOnWindowFocus,
    refetchOnMount: false,
  })

export const validatorPoolsQueryOptions = (
  validatorIds: number[],
  refetchInterval = 1000 * 30, // 30 seconds
  refetchOnWindowFocus = true,
) =>
  queryOptions({
    queryKey: ['validator-pools', validatorIds.join(',')],
    queryFn: () => fetchValidatorsPools(validatorIds),
    refetchInterval,
    refetchOnWindowFocus,
    refetchOnMount: false,
  })

export const validatorSingleQueryKey = (validatorId: number) => [
  'validator-single',
  validatorId.toString(),
]

export const validatorSingleQueryOptions = (validatorId: number, enabled = true) =>
  queryOptions({
    queryKey: validatorSingleQueryKey(validatorId),
    queryFn: () => fetchSingleValidatorInfo(validatorId),
    staleTime: Infinity,
    refetchInterval: 1000 * 30, // 30 seconds
    refetchOnWindowFocus: true,
    refetchOnMount: false,
    enabled,
  })

export const validatorsQueryOptions = (validatorIds: number[], queryClient: QueryClient) =>
  queryOptions({
    queryKey: ['validator', validatorIds.join(',')],
    queryFn: async () => {
      const data = await fetchValidatorsInfo(validatorIds)
      data.forEach((validatorData, i) => {
        const validatorId = validatorIds[i]
        queryClient.setQueryData(validatorSingleQueryKey(validatorId), validatorData)
      })
      return data
    },
    staleTime: Infinity,
    refetchInterval: 1000 * 30, // 30 seconds
    refetchOnWindowFocus: true,
    refetchOnMount: false,
    enabled: validatorIds.length > 0,
  })

export const validatorNodePoolAssignmentsQueryOptions = (validatorIds: number[], enabled = true) =>
  queryOptions({
    queryKey: ['validator-node-pool-assignments', validatorIds.join(',')],
    queryFn: () => fetchValidatorNodePoolAssignments(validatorIds),
    staleTime: Infinity,
    refetchInterval: 1000 * 60 * 60 * 2, // 2 hours
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    enabled,
  })

export const poolBalanceAndLastPayoutQueryKey = (poolAppId: bigint) => [
  'pool-balance-last-payout',
  poolAppId.toString(),
]

export const poolBalanceAndLastPayoutQueryOptions = (poolAppId: bigint) =>
  queryOptions({
    queryKey: poolBalanceAndLastPayoutQueryKey(poolAppId),
    queryFn: async () => {
      const [data] = await fetchPoolBalancesAndLastPayouts([poolAppId])
      return data
    },
    staleTime: Infinity,
    refetchInterval: 1000 * 60 * 30, // 30 minutes, same as validatorSingleMetricsQueryOptions
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })

export const poolBalancesAndLastPayoutsQueryOptions = (
  poolAppIds: bigint[],
  queryClient: QueryClient,
) =>
  queryOptions({
    queryKey: ['pool-balances-last-payouts', poolAppIds.join(',')],
    queryFn: async () => {
      const data = await fetchPoolBalancesAndLastPayouts(poolAppIds)
      data.forEach((balanceData, i) => {
        const poolAppId = poolAppIds[i]
        queryClient.setQueryData(poolBalanceAndLastPayoutQueryKey(poolAppId), balanceData)
      })
      return data
    },
    staleTime: Infinity,
    refetchInterval: 1000 * 60 * 30, // 30 minutes, same as validatorSingleMetricsQueryOptions
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    enabled: poolAppIds.length > 0,
  })

export const validatorSingleMetricsQueryOptions = (validatorId: number, queryClient: QueryClient) =>
  queryOptions({
    queryKey: ['validator-metrics', String(validatorId)],
    queryFn: async () => {
      // Get cached data from other queries
      const { config, state, pools } = await queryClient.ensureQueryData(
        validatorSingleQueryOptions(validatorId),
      )

      const poolAppIds = pools.map((pool: { poolAppId: bigint }) => pool.poolAppId)
      const poolBalancesLastPayouts = await Promise.all(
        poolAppIds.map((poolAppId) =>
          queryClient.ensureQueryData(poolBalanceAndLastPayoutQueryOptions(poolAppId)),
        ),
      )

      const poolDataPromises = pools.map((pool, i) =>
        processPoolData(pool, poolBalancesLastPayouts[i]!),
      )

      const [params, ...processedPoolsData] = await Promise.all([
        algorandClient.getSuggestedParams(),
        ...poolDataPromises,
      ])

      // Ignore pools with less than 30k ALGO balance
      const filteredPoolsData = processedPoolsData.filter(
        (pool) => pool.balance >= AlgoAmount.Algos(30_000).microAlgos,
      )

      return calculateValidatorPoolMetrics(
        filteredPoolsData,
        state.totalAlgoStaked,
        BigInt(config.epochRoundLength),
        BigInt(params.firstValid),
      )
    },
    enabled: !!queryClient.getQueryData(validatorSingleQueryKey(validatorId)),
    staleTime: 1000 * 60 * 30, // 30 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
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
    staleTime: 1000 * 60 * 5, // 5 mins
    retry: (failureCount, error) => {
      if (error instanceof AxiosError) {
        return error.response?.status !== 404 && failureCount < 3
      }
      return false
    },
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })

export const nfdLookupQueryOptions = (
  address: string | null,
  params: Omit<NfdGetLookupParams, 'address'> = { view: 'thumbnail' },
  options: CacheRequestConfig = {},
) =>
  queryOptions<Nfd | null, AxiosError>({
    queryKey: ['nfd-lookup', address, params],
    queryFn: () => fetchNfdReverseLookup(String(address), params, options),
    enabled: !!address,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: (failureCount, error) => {
      if (error instanceof AxiosError) {
        return error.response?.status !== 404 && failureCount < 3
      }
      return false
    },
  })

////////////////////////////////////////////////////////////
// Asset queries
////////////////////////////////////////////////////////////

export const assetQueryOptions = (assetId: number) =>
  queryOptions<Asset>({
    queryKey: ['asset', assetId],
    queryFn: () => fetchAsset(assetId),
    staleTime: Infinity,
    enabled: assetId > 0,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })

export const assetsQueryOptions = (assetIds: bigint[] | number[]) =>
  queryOptions<Asset[]>({
    queryKey: ['assets', assetIds.join(',')],
    queryFn: () => {
      return assetIds.length === 1
        ? // skip simulate for a single asset
          fetchAsset(Number(assetIds[0])).then((a) => [a])
        : fetchAssets(assetIds)
    },
    staleTime: Infinity,
    enabled: assetIds.length > 0,
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
