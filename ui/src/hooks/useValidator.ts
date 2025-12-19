import { convertPoolTolocalPoolInfo, createBaseValidator } from '@/api/contracts'
import {
  assetsQueryOptions,
  nfdQueryOptions,
  validatorSingleMetricsQueryOptions,
  validatorSingleQueryOptions,
} from '@/api/queries'
import { GatingType } from '@/constants/gating'
import { Validator } from '@/interfaces/validator'
import { useQueryClient, useSuspenseQueries, useSuspenseQuery } from '@tanstack/react-query'
import * as React from 'react'

/**
 * Fetches validator data and enrichment data in parallel.
 */
export function useValidator(validatorId: number): Validator | undefined {
  const queryClient = useQueryClient()

  // Core validator queries
  const [validatorQuery, metricsQuery] = useSuspenseQueries({
    queries: [
      validatorSingleQueryOptions(validatorId),
      validatorSingleMetricsQueryOptions(validatorId, queryClient),
    ],
  })

  const config = validatorQuery.data?.config

  const assetIds = React.useMemo(() => {
    return [
      validatorQuery.data?.config.rewardTokenId,
      ...validatorQuery.data?.config.entryGatingAssets,
    ].filter((v) => !!v && v > 0n)
  }, [validatorQuery.data])

  const assetQuery = useSuspenseQuery(assetsQueryOptions(assetIds))

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
    if (!validatorQuery.data) return undefined

    const { config, nodeAssignment: nodePoolAssignment, pools, state } = validatorQuery.data

    // Create base validator
    const baseValidator = createBaseValidator({
      id: validatorId,
      config,
      state,
      nodePoolAssignment,
      pools: pools.map((poolInfo, index) => {
        return convertPoolTolocalPoolInfo(poolInfo, index + 1)
      }),
    })

    // Add enrichment data
    if (config.rewardTokenId) {
      baseValidator.rewardToken = assetQuery.data?.find(
        ({ index }) => index === config.rewardTokenId,
      )
    }

    if (baseValidator.config.entryGatingType === GatingType.AssetId) {
      const gatingAssets = config.entryGatingAssets
        .filter((assetId) => !!assetId)
        .map((assetId) => assetQuery.data.find((asset) => asset.index === assetId))
        .filter((e) => e !== undefined)
      baseValidator.gatingAssets = gatingAssets?.length > 0 ? gatingAssets : undefined
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
  }, [validatorId, validatorQuery.data, nfdQuery?.data, assetQuery.data, metricsQuery.data])

  return validator
}
