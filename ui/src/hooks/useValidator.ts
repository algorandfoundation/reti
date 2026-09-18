import {
  useQuery,
  useQueryClient,
  useSuspenseQueries,
  useSuspenseQuery,
} from '@tanstack/react-query'
import algosdk from 'algosdk'
import * as React from 'react'
import { createBaseValidator } from '@/api/contracts'
import {
  assetQueryOptions,
  nfdQueryOptions,
  poolGlobalStatesQueryOptions,
  validatorConfigQueryOptions,
  validatorMetricsQueryOptions,
  validatorNodePoolAssignmentsQueryOptions,
  validatorPoolsQueryOptions,
  validatorStateQueryOptions,
} from '@/api/queries'
import { GatingType } from '@/constants/gating'
import { Validator } from '@/interfaces/validator'

/**
 * Fetches validator data and enrichment data in parallel.
 */
export function useValidator(validatorId: number): Validator | undefined {
  const queryClient = useQueryClient()

  // Core validator queries
  const [configQuery, stateQuery, poolsQuery, nodePoolAssignmentQuery] = useSuspenseQueries({
    queries: [
      validatorConfigQueryOptions(validatorId),
      validatorStateQueryOptions(validatorId),
      validatorPoolsQueryOptions(validatorId),
      validatorNodePoolAssignmentsQueryOptions(validatorId),
      // Not read here. Suspending on it is what guarantees the metrics queryFn below finds it
      // in the cache instead of falling back to a request per pool.
      poolGlobalStatesQueryOptions,
    ],
  })

  // Metrics takes its inputs explicitly, so it has to run after the queries above resolve.
  // Suspense guarantees their data is defined here, including the bulk pool state its queryFn
  // reads back out of the cache.
  const metricsQuery = useSuspenseQuery(
    validatorMetricsQueryOptions(validatorId, queryClient, {
      pools: poolsQuery.data,
      totalAlgoStaked: stateQuery.data.totalAlgoStaked,
      epochRoundLength: configQuery.data.epochRoundLength,
    }),
  )

  // Reward token query
  const rewardTokenQuery = useQuery({
    ...assetQueryOptions(Number(configQuery.data?.rewardTokenId)),
    enabled: Boolean(configQuery.data?.rewardTokenId && configQuery.data.rewardTokenId > 0n),
  })

  // Gating asset queries
  const gatingAssetQueries = useSuspenseQueries({
    queries: [
      ...(configQuery.data?.entryGatingType === GatingType.AssetId
        ? configQuery.data.entryGatingAssets
            .filter((id): id is bigint => id > 0n)
            .map((id) => assetQueryOptions(Number(id)))
        : []),
    ],
  })

  // NFD query
  const [nfdQuery] = useSuspenseQueries({
    queries: [
      ...(configQuery.data?.nfdForInfo && configQuery.data.nfdForInfo > 0
        ? [nfdQueryOptions(Number(configQuery.data.nfdForInfo), { view: 'full' })]
        : []),
    ],
  })

  // Combine all data synchronously
  const validator = React.useMemo((): Validator | undefined => {
    if (!configQuery.data || !stateQuery.data || !poolsQuery.data || !nodePoolAssignmentQuery.data)
      return undefined

    // Create base validator
    const baseValidator = createBaseValidator({
      id: validatorId,
      config: configQuery.data,
      state: stateQuery.data,
      pools: poolsQuery.data,
      nodePoolAssignment: nodePoolAssignmentQuery.data,
    })

    // Add enrichment data
    if (rewardTokenQuery.data) {
      baseValidator.rewardToken = rewardTokenQuery.data
    }

    if (baseValidator.config.entryGatingType === GatingType.AssetId) {
      baseValidator.gatingAssets = gatingAssetQueries
        .map((q) => q.data)
        .filter(Boolean) as algosdk.modelsv2.Asset[]
    }

    if (nfdQuery?.data) {
      baseValidator.nfd = nfdQuery.data
    }

    // Add metrics
    if (metricsQuery.data) {
      baseValidator.rewardsBalance = metricsQuery.data.rewardsBalance
      baseValidator.roundsSinceLastPayout = metricsQuery.data.roundsSinceLastPayout
      baseValidator.apy = metricsQuery.data.apy
      baseValidator.extDeposits = metricsQuery.data.extDeposits
    }

    return baseValidator
  }, [
    validatorId,
    configQuery.data,
    stateQuery.data,
    poolsQuery.data,
    nodePoolAssignmentQuery.data,
    rewardTokenQuery.data,
    gatingAssetQueries,
    nfdQuery?.data,
    metricsQuery.data,
  ])

  return validator
}
