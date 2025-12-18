import { createBaseValidator } from '@/api/contracts'
import {
  assetQueryOptions,
  nfdQueryOptions,
  nodelyPerfMetricsQueryOptions,
  numValidatorsQueryOptions,
  validatorConfigsQueryOptions,
  validatorNodePoolAssignmentsQueryOptions,
  validatorPoolsQueryOptions,
  validatorStatesQueryOptions,
} from '@/api/queries'
import { GatingType } from '@/constants/gating'
import { Validator } from '@/interfaces/validator'
import { useQueries, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import algosdk from 'algosdk'
import * as React from 'react'

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
    () => validatorConfigsQueryOptions(validatorIds),
    [validatorIds],
  )

  const validatorStateQueries = React.useMemo(
    () => validatorStatesQueryOptions(validatorIds, 120000, false),
    [validatorIds],
  )

  const validatorPoolsQueries = React.useMemo(
    () => validatorPoolsQueryOptions(validatorIds, 120000, false),
    [validatorIds],
  )

  const validatorNodePoolAssignmentQueries = React.useMemo(
    () => validatorNodePoolAssignmentsQueryOptions(validatorIds),
    [validatorIds],
  )

  // plan: use queued queries to rate limit
  // metrics query should have enabled based on config+state+node data being available

  // const metricsQueries = React.useMemo(
  //   () => validatorMetricsQueryOptions(validatorIds, queryClient),
  //   [validatorIds],
  // )

  const configQuery = useQuery(validatorConfigQueries)
  const stateQuery = useQuery(validatorStateQueries)
  const poolsQuery = useQuery(validatorPoolsQueries)
  const nodePoolAssignmentQuery = useQuery(validatorNodePoolAssignmentQueries)
  // const metricsQuery = useQuery(metricsQueries)

  // Fetch enrichment data
  const rewardTokenQueries = useQueries({
    queries:
      configQuery.data
        ?.map((q) => q.rewardTokenId)
        .filter((id): id is bigint => id !== undefined && id > 0n)
        .map((id) => assetQueryOptions(Number(id))) ?? [],
  })

  const gatingAssetQueries = useQueries({
    queries:
      configQuery.data
        ?.map((q) =>
          q.entryGatingType === GatingType.AssetId
            ? q.entryGatingAssets.filter((id): id is bigint => id > 0n)
            : [],
        )
        .map((id) => assetQueryOptions(Number(id))) ?? [],
  })

  const nfdQueries = useQueries({
    queries:
      configQuery.data
        ?.map((q) => Number(q.nfdForInfo))
        .filter((id) => id > 0)
        .map((id) => nfdQueryOptions(id, { view: 'full' })) ?? [],
  })

  // nodely performance data
  const nodelyPerfQuery = useQuery(nodelyPerfMetricsQueryOptions())

  // console.log('state data', stateQueries.data)

  // Combine all data synchronously
  const validators = React.useMemo(() => {
    const result: Validator[] = []

    for (let i = 0; i < validatorIds.length; i++) {
      const validatorId = validatorIds[i]

      // Find the data for this validator ID in each query result
      const config = queryClient
        .getQueryData(validatorConfigsQueryOptions(validatorIds).queryKey)
        ?.at(i)
      const state = queryClient
        .getQueryData(validatorStatesQueryOptions(validatorIds).queryKey)
        ?.at(i)
      const pools = queryClient
        .getQueryData(validatorPoolsQueryOptions(validatorIds).queryKey)
        ?.at(i)
      const nodePoolAssignment = queryClient
        .getQueryData(validatorNodePoolAssignmentsQueryOptions(validatorIds).queryKey)
        ?.at(i)
      // const metrics = queryClient
      //   .getQueryData(validatorMetricsQueryOptions(validatorIds, queryClient).queryKey)
      //   ?.at(i)

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
      if (nodelyPerfQuery.data && nodelyPerfQuery.data.data) {
        const perfScore = nodelyPerfQuery.data.data.find(
          (q) => q.validatorid === baseValidator.id.toString(),
        )?.perf
        baseValidator.perf = perfScore
      }

      // Add metrics if available
      // if (metrics) {
      //   baseValidator.rewardsBalance = metrics.rewardsBalance
      //   baseValidator.roundsSinceLastPayout = metrics.roundsSinceLastPayout
      //   baseValidator.apy = metrics.apy
      //   baseValidator.extDeposits = metrics.extDeposits
      // }

      result.push(baseValidator)
    }

    return result
  }, [
    validatorIds,
    configQuery.data,
    stateQuery.data,
    poolsQuery.data,
    nodePoolAssignmentQuery.data,
    rewardTokenQueries,
    gatingAssetQueries,
    nfdQueries,
    // metricsQuery.data,
  ])

  const isLoading =
    configQuery.isLoading ||
    stateQuery.isLoading ||
    poolsQuery.isLoading ||
    nodePoolAssignmentQuery.isLoading

  const error =
    configQuery.error || stateQuery.error || poolsQuery.error || nodePoolAssignmentQuery.error

  return {
    validators,
    isLoading,
    error,
  }
}
