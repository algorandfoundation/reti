import { createBaseValidator } from '@/api/contracts'
import {
  assetsQueryOptions,
  nfdQueryOptions,
  nodelyPerfMetricsQueryOptions,
  numValidatorsQueryOptions,
  poolBalancesAndLastPayoutsQueryOptions,
  validatorSingleMetricsQueryOptions,
  validatorsQueryOptions,
} from '@/api/queries'
import { GatingType } from '@/constants/gating'
import { Asset } from '@/interfaces/asset'
import { Validator } from '@/interfaces/validator'
import { unique } from '@/utils/tests/utils'
import { useQueries, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import * as React from 'react'
import { useQueuedQueries } from './useQueuedQueries'

/**
 * Fetches all validator data and enrichment data in parallel.
 */
export function useValidators(): {
  validators: Validator[]
  isLoading: boolean
  error: Error | undefined | null
} {
  const queryClient = useQueryClient()

  // Get total number of validators
  const numValidatorsQuery = useSuspenseQuery(numValidatorsQueryOptions)
  const numValidators = numValidatorsQuery.data

  const validatorIds = React.useMemo(() => {
    return Array.from({ length: numValidators }, (_, i) => i + 1)
  }, [numValidators])

  // Memoize query options
  const validatorQueryOptionsMemo = React.useMemo(
    () => validatorsQueryOptions(validatorIds, queryClient),
    [validatorIds],
  )

  const validatorsQuery = useQuery(validatorQueryOptionsMemo)

  // Memoize metrics query options
  // sort validators by their total algo staked descending, which is the default sort
  const poolAppIds = React.useMemo(
    () => validatorsQuery.data?.flatMap(({ pools }) => pools.map((pool) => pool.poolAppId)) ?? [],
    [validatorIds, validatorsQuery.data],
  )

  const poolBalancesQueryOpts = React.useMemo(
    () => poolBalancesAndLastPayoutsQueryOptions(poolAppIds, queryClient),
    [poolAppIds, queryClient],
  )

  const poolBalancesQuery = useQuery(poolBalancesQueryOpts)

  // Memoize metrics query options
  // sort validators by their total algo staked descending, which is the default sort
  const metricsQueries = React.useMemo(
    () =>
      poolBalancesQuery.data && validatorsQuery.data
        ? validatorsQuery.data
            .map((validator, id) => ({
              id: validatorIds[id]!,
              ...validator,
            }))
            .sort(({ state: { totalAlgoStaked: a } }, { state: { totalAlgoStaked: b } }) =>
              a > b ? -1 : 1,
            )
            .map(({ id }) => ({
              ...validatorSingleMetricsQueryOptions(id, queryClient),
            }))
        : [],
    [validatorIds, validatorsQuery.data, poolBalancesQuery.data],
  )

  // Use queued queries for metrics. 8 in flight at any time
  const queuedMetricsQueries = useQueuedQueries(metricsQueries, 8)

  // nodely performance data
  const nodelyPerfQuery = useQuery(nodelyPerfMetricsQueryOptions())

  // look up all assets with simulate
  const assetIds = React.useMemo(() => {
    const rewardAssetIds =
      validatorsQuery.data
        ?.map((q) => q.config.rewardTokenId)
        .filter((id): id is bigint => id !== undefined && id > 0n) ?? []

    const gatingAssetIds =
      validatorsQuery.data?.flatMap((q) =>
        q.config.entryGatingType === GatingType.AssetId
          ? q.config.entryGatingAssets.filter((id): id is bigint => id > 0n)
          : [],
      ) ?? []

    return unique([...rewardAssetIds, ...gatingAssetIds])
  }, [validatorsQuery.data])

  const assetQuery = useQuery(assetsQueryOptions(assetIds))

  const nfdQueries = useQueries({
    queries: poolBalancesQuery.data // delay NFD queries until pools data is loaded. NFD lookups starve available connection threads
      ? validatorsQuery
          .data!.map((q) => Number(q.config.nfdForInfo))
          .filter((id) => id > 0)
          .map((id) => nfdQueryOptions(id, { view: 'full' }))
      : [],
  })

  // Combine all data synchronously
  const validators = React.useMemo(() => {
    if (!validatorsQuery.data) return []

    const result: Validator[] = []

    for (let i = 0; i < validatorIds.length; i++) {
      const validatorId = validatorIds[i]

      const { config, state, pools, nodeAssignment: nodePoolAssignment } = validatorsQuery.data[i]!

      const metrics = queryClient.getQueryData(
        validatorSingleMetricsQueryOptions(validatorId, queryClient).queryKey,
      )

      if (!config || !state || !pools || !nodePoolAssignment) continue

      // Create base validator
      const baseValidator = createBaseValidator({
        id: validatorId,
        config,
        state,
        pools,
        nodePoolAssignment,
      })

      // Add enrichment data if available
      if (baseValidator.config.rewardTokenId > 0) {
        const rewardToken = assetQuery.data?.find(
          (q) => q.index === baseValidator.config.rewardTokenId,
        )
        if (rewardToken) {
          baseValidator.rewardToken = rewardToken
        }
      }

      if (baseValidator.config.entryGatingType === GatingType.AssetId) {
        baseValidator.gatingAssets = baseValidator.config.entryGatingAssets
          .map((assetId) => assetQuery.data?.find((q) => q.index === assetId))
          .filter(Boolean) as Asset[]
      }

      if (baseValidator.config.nfdForInfo > 0) {
        const nfd = nfdQueries.find(
          (q) => q.data?.appID === Number(baseValidator.config.nfdForInfo),
        )?.data
        if (nfd) {
          baseValidator.nfd = nfd
        }
      }

      if (nodelyPerfQuery.data && nodelyPerfQuery.data.data) {
        const perfScore = nodelyPerfQuery.data.data.find(
          (q) => q.validatorid === baseValidator.id.toString(),
        )?.perf
        baseValidator.perf = perfScore
      }

      // Add metrics if available
      if (metrics) {
        baseValidator.rewardsBalance = metrics.rewardsBalance
        baseValidator.roundsSinceLastPayout = metrics.roundsSinceLastPayout
        baseValidator.apy = metrics.apy
        baseValidator.extDeposits = metrics.extDeposits
      }

      result.push(baseValidator)
    }

    return result
  }, [validatorIds, validatorsQuery.data, assetQuery.data, nfdQueries, queuedMetricsQueries.data])

  const { isLoading, error } = validatorsQuery

  return { validators, isLoading, error }
}
