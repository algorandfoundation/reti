import { QueryClient, keepPreviousData, queryOptions } from '@tanstack/react-query'
import algosdk from 'algosdk'
import { AxiosError } from 'axios'
import { CacheRequestConfig } from 'axios-cache-interceptor'
import { fetchAsset, fetchAssetHoldings, fetchBalance, fetchBlockTimes } from '@/api/algod'
import {
  fetchMbrAmounts,
  fetchNumValidators,
  fetchPoolApy,
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
import { calculateValidatorPoolMetrics } from '@/utils/contracts'

////////////////////////////////////////////////////////////
// Core protocol data queries
////////////////////////////////////////////////////////////

export const numValidatorsQueryOptions = queryOptions({
  queryKey: ['num-validators'],
  queryFn: fetchNumValidators,
  staleTime: 1000 * 60, // 1 minute
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

export const validatorConfigQueryOptions = (validatorId: number) =>
  queryOptions({
    queryKey: ['validator-config', String(validatorId)],
    queryFn: () => fetchValidatorConfig(validatorId),
    staleTime: Infinity,
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
    refetchInterval,
    refetchOnWindowFocus,
    refetchOnMount: false,
  })

export const validatorNodePoolAssignmentsQueryOptions = (validatorId: number, enabled = true) =>
  queryOptions({
    queryKey: ['validator-node-pool-assignments', String(validatorId)],
    queryFn: () => fetchValidatorNodePoolAssignments(validatorId),
    staleTime: Infinity,
    refetchInterval: 1000 * 60 * 60 * 2, // 2 hours
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    enabled,
  })

export const validatorMetricsQueryOptions = (validatorId: number, queryClient: QueryClient) =>
  queryOptions({
    queryKey: ['validator-metrics', String(validatorId)],
    queryFn: async () => {
      // Get cached data from other queries
      const pools = await queryClient.ensureQueryData(validatorPoolsQueryOptions(validatorId))
      const state = await queryClient.ensureQueryData(validatorStateQueryOptions(validatorId))
      const config = await queryClient.ensureQueryData(validatorConfigQueryOptions(validatorId))

      const params = await algorandClient.getSuggestedParams()
      const poolDataPromises = pools.map((pool) => processPoolData(pool))
      const processedPoolsData = await Promise.all(poolDataPromises)

      return calculateValidatorPoolMetrics(
        processedPoolsData,
        state.totalAlgoStaked,
        BigInt(config.epochRoundLength),
        BigInt(params.firstValid),
      )
    },
    staleTime: 1000 * 30, // 30 seconds
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
