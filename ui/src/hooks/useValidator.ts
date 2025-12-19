import {
  convertPoolTolocalPoolInfo,
  convertPoolTupleToPool,
  createBaseValidator,
} from '@/api/contracts'
import {
  assetQueryOptions,
  nfdQueryOptions,
  validatorAllQueryOptions,
  validatorSingleMetricsQueryOptions,
} from '@/api/queries'
import { GatingType } from '@/constants/gating'
import { Asset } from '@/interfaces/asset'
import { Validator } from '@/interfaces/validator'
import { useQuery, useQueryClient, useSuspenseQueries } from '@tanstack/react-query'
import * as React from 'react'

/**
 * Fetches validator data and enrichment data in parallel.
 */
export function useValidator(validatorId: number): Validator | undefined {
  const queryClient = useQueryClient()

  // Core validator queries
  const [allPoolInfoQuery, metricsQuery] = useSuspenseQueries({
    queries: [
      validatorAllQueryOptions(validatorId),
      validatorSingleMetricsQueryOptions(validatorId, queryClient),
    ],
  })

  const config = allPoolInfoQuery.data?.config
  const state = allPoolInfoQuery.data?.state
  const pools = allPoolInfoQuery.data?.poolInfo
  const nodePoolAssignment = allPoolInfoQuery.data?.nodeAssignment

  // Reward token query
  const rewardTokenQuery = useQuery({
    ...assetQueryOptions(Number(config?.rewardTokenId)),
    enabled: Boolean(config && config.rewardTokenId > 0n),
  })

  // Gating asset queries
  const gatingAssetQueries = useSuspenseQueries({
    queries: [
      ...(config?.entryGatingType === GatingType.AssetId
        ? config.entryGatingAssets
            .filter((id): id is bigint => id > 0n)
            .map((id) => assetQueryOptions(Number(id)))
        : []),
    ],
  })

  // NFD query
  const [nfdQuery] = useSuspenseQueries({
    queries: [
      ...(config?.nfdForInfo && config.nfdForInfo > 0
        ? [nfdQueryOptions(Number(config.nfdForInfo), { view: 'full' })]
        : []),
    ],
  })

  // Combine all data synchronously
  const validator = React.useMemo((): Validator | undefined => {
    if (!config || !state || !pools || !nodePoolAssignment) return undefined

    // Create base validator
    const baseValidator = createBaseValidator({
      id: validatorId,
      config: config!,
      state: state,
      pools: pools.map((tuple, index) =>
        convertPoolTolocalPoolInfo(convertPoolTupleToPool(tuple), index + 1),
      ),
      nodePoolAssignment: nodePoolAssignment,
    })

    // Add enrichment data
    if (rewardTokenQuery.data) {
      baseValidator.rewardToken = rewardTokenQuery.data
    }

    if (baseValidator.config.entryGatingType === GatingType.AssetId) {
      baseValidator.gatingAssets = gatingAssetQueries.map((q) => q.data).filter(Boolean) as Asset[]
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
    allPoolInfoQuery.data,
    rewardTokenQuery.data,
    gatingAssetQueries,
    nfdQuery?.data,
    metricsQuery.data,
  ])

  return validator
}
