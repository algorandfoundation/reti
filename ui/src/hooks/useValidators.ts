import { useQueries, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import algosdk from 'algosdk'
import * as React from 'react'
import { createBaseValidator } from '@/api/contracts'
import {
  assetQueryOptions,
  nfdQueryOptions,
  numValidatorsQueryOptions,
  validatorConfigQueryOptions,
  validatorMetricsQueryOptions,
  validatorNodePoolAssignmentsQueryOptions,
  validatorPoolsQueryOptions,
  validatorStateQueryOptions,
} from '@/api/queries'
import { GatingType } from '@/constants/gating'
import { useQueuedQueries } from '@/hooks/useQueuedQueries'
import { Validator } from '@/interfaces/validator'

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
  const validatorConfigQueries = React.useMemo(
    () => validatorIds.map((id) => validatorConfigQueryOptions(id)),
    [validatorIds],
  )

  const validatorStateQueries = React.useMemo(
    () => validatorIds.map((id) => validatorStateQueryOptions(id, 120000, false)),
    [validatorIds],
  )

  const validatorPoolsQueries = React.useMemo(
    () => validatorIds.map((id) => validatorPoolsQueryOptions(id, 120000, false)),
    [validatorIds],
  )

  const validatorNodePoolAssignmentQueries = React.useMemo(
    () => validatorIds.map((id) => validatorNodePoolAssignmentsQueryOptions(id)),
    [validatorIds],
  )

  // Use queued queries for validator data
  const configQueries = useQueuedQueries(validatorConfigQueries)
  const stateQueries = useQueuedQueries(validatorStateQueries)
  const poolsQueries = useQueuedQueries(validatorPoolsQueries)
  const nodePoolAssignmentQueries = useQueuedQueries(validatorNodePoolAssignmentQueries)

  // Fetch enrichment data
  const rewardTokenQueries = useQueries({
    queries: configQueries.data
      .map((q) => q?.rewardTokenId)
      .filter((id): id is bigint => id !== undefined && id > 0n)
      .map((id) => assetQueryOptions(Number(id))),
  })

  const gatingAssetQueries = useQueries({
    queries: configQueries.data
      .flatMap((q) =>
        q?.entryGatingType === GatingType.AssetId
          ? q.entryGatingAssets.filter((id): id is bigint => id > 0n)
          : [],
      )
      .map((id) => assetQueryOptions(Number(id))),
  })

  const nfdQueries = useQueries({
    queries: configQueries.data
      .map((q) => Number(q?.nfdForInfo))
      .filter((id) => id > 0)
      .map((id) => nfdQueryOptions(id, { view: 'full' })),
  })

  // Memoize metrics query options
  const metricsQueries = React.useMemo(
    () =>
      validatorIds.map((id) => ({
        ...validatorMetricsQueryOptions(id, queryClient),
        enabled: !stateQueries.isFetching && !poolsQueries.isFetching,
      })),
    [validatorIds, stateQueries.isFetching, poolsQueries.isFetching],
  )

  // Use queued queries for metrics
  const queuedMetricsQueries = useQueuedQueries(metricsQueries, 4) // Process 4 validators every second

  // Combine all data synchronously
  const validators = React.useMemo(() => {
    const result: Validator[] = []

    for (let i = 0; i < validatorIds.length; i++) {
      const validatorId = validatorIds[i]

      // Find the data for this validator ID in each query result
      const config = queryClient.getQueryData(validatorConfigQueryOptions(validatorId).queryKey)
      const state = queryClient.getQueryData(validatorStateQueryOptions(validatorId).queryKey)
      const pools = queryClient.getQueryData(validatorPoolsQueryOptions(validatorId).queryKey)
      const nodePoolAssignment = queryClient.getQueryData(
        validatorNodePoolAssignmentsQueryOptions(validatorId).queryKey,
      )
      const metrics = queryClient.getQueryData(
        validatorMetricsQueryOptions(validatorId, queryClient).queryKey,
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
        const rewardToken = rewardTokenQueries.find(
          (q) => q.data?.index === baseValidator.config.rewardTokenId,
        )?.data
        if (rewardToken) {
          baseValidator.rewardToken = rewardToken
        }
      }

      if (baseValidator.config.entryGatingType === GatingType.AssetId) {
        baseValidator.gatingAssets = baseValidator.config.entryGatingAssets
          .map((assetId) => gatingAssetQueries.find((q) => q.data?.index === assetId)?.data)
          .filter(Boolean) as algosdk.modelsv2.Asset[]
      }

      if (baseValidator.config.nfdForInfo > 0) {
        const nfd = nfdQueries.find(
          (q) => q.data?.appID === Number(baseValidator.config.nfdForInfo),
        )?.data
        if (nfd) {
          baseValidator.nfd = nfd
        }
      }

      // Add metrics if available
      if (metrics) {
        baseValidator.rewardsBalance = metrics.rewardsBalance
        baseValidator.roundsSinceLastPayout = metrics.roundsSinceLastPayout
        baseValidator.apy = metrics.apy
      }

      result.push(baseValidator)
    }

    return result
  }, [
    validatorIds,
    configQueries.data,
    stateQueries.data,
    poolsQueries.data,
    nodePoolAssignmentQueries.data,
    rewardTokenQueries,
    gatingAssetQueries,
    nfdQueries,
    queuedMetricsQueries.data,
  ])

  const isLoading =
    configQueries.isLoading ||
    stateQueries.isLoading ||
    poolsQueries.isLoading ||
    nodePoolAssignmentQueries.isLoading

  const error =
    configQueries.error ||
    stateQueries.error ||
    poolsQueries.error ||
    nodePoolAssignmentQueries.error

  return {
    validators,
    isLoading,
    error,
  }
}
