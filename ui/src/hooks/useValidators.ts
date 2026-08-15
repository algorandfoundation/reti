import { useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import algosdk from 'algosdk'
import * as React from 'react'
import { createBaseValidator } from '@/api/contracts'
import {
  allValidatorsQueryOptions,
  assetQueryOptions,
  nfdQueryOptions,
  nodelyPerfMetricsQueryOptions,
  poolGlobalStatesQueryOptions,
  validatorMetricsQueryOptions,
} from '@/api/queries'
import { GatingType } from '@/constants/gating'
import { useQueuedQueries } from '@/hooks/useQueuedQueries'
import { Validator } from '@/interfaces/validator'

/**
 * Dedupes and sorts a list of ids, returning a referentially stable array while the
 * contents are unchanged.
 */
function useStableIds(ids: number[]): number[] {
  const unique = Array.from(new Set(ids)).sort((a, b) => a - b)
  const key = unique.join(',')
  const cache = React.useRef<{ key: string; ids: number[] }>({ key, ids: unique })

  if (cache.current.key !== key) {
    cache.current = { key, ids: unique }
  }

  return cache.current.ids
}

/**
 * Fetches all validator data and enrichment data in parallel.
 */
export function useValidators(): {
  validators: Validator[]
  isLoading: boolean
  error: Error | undefined | null
} {
  const queryClient = useQueryClient()

  // Every validator's config/state/pools/nodePoolAssignments in a single request
  const allValidatorsQuery = useSuspenseQuery(allValidatorsQueryOptions(queryClient))
  const validatorData = allValidatorsQuery.data

  // Enrichment lookups are queued rather than fired at once. The core data now lands in a
  // single tick, so an unthrottled useQueries here would issue every NFD lookup
  // simultaneously.
  //
  // The id lists are keyed on their own contents so a refetch that leaves them unchanged
  // (the common case - these rarely change) doesn't restart the batching queue.
  const rewardTokenIds = useStableIds(
    validatorData.map((validator) => Number(validator.config.rewardTokenId)).filter((id) => id > 0),
  )

  const gatingAssetIds = useStableIds(
    validatorData
      .flatMap((validator) =>
        validator.config.entryGatingType === GatingType.AssetId
          ? validator.config.entryGatingAssets
          : [],
      )
      .map(Number)
      .filter((id) => id > 0),
  )

  const nfdAppIds = useStableIds(
    validatorData.map((validator) => Number(validator.config.nfdForInfo)).filter((id) => id > 0),
  )

  const rewardTokenQueryOptions = React.useMemo(
    () => rewardTokenIds.map((id) => assetQueryOptions(id)),
    [rewardTokenIds],
  )

  const gatingAssetQueryOptions = React.useMemo(
    () => gatingAssetIds.map((id) => assetQueryOptions(id)),
    [gatingAssetIds],
  )

  const nfdQueryOptionsList = React.useMemo(
    () => nfdAppIds.map((id) => nfdQueryOptions(id, { view: 'full' })),
    [nfdAppIds],
  )

  const rewardTokenQueries = useQueuedQueries(rewardTokenQueryOptions, { host: 'algod' })
  const gatingAssetQueries = useQueuedQueries(gatingAssetQueryOptions, { host: 'algod' })
  const nfdQueries = useQueuedQueries(nfdQueryOptionsList, { host: 'nfd' })

  // Every pool's lastPayout in one request, shared by all the metrics queries below
  const poolGlobalStatesQuery = useQuery(poolGlobalStatesQueryOptions)

  // Memoize metrics query options
  const metricsQueries = React.useMemo(
    () =>
      validatorData.map((validator) => ({
        ...validatorMetricsQueryOptions(validator.id, queryClient, {
          pools: validator.pools,
          totalAlgoStaked: validator.state.totalAlgoStaked,
          epochRoundLength: validator.config.epochRoundLength,
        }),
        // Wait for the bulk read to settle, not to succeed: if it fails, metrics fall back to
        // reading each pool's global state individually rather than never running at all.
        enabled: allValidatorsQuery.isSuccess && !poolGlobalStatesQuery.isPending,
      })),
    [validatorData, allValidatorsQuery.isSuccess, poolGlobalStatesQuery.isPending, queryClient],
  )

  // nodely performance data
  const nodelyPerfQuery = useQuery(nodelyPerfMetricsQueryOptions())

  // Metrics stay eager for every validator - the APY, rewards and status columns are all
  // sortable, and sorting on a column that only some rows have values for is broken sorting.
  // The cost is instead managed by metering the queue: a batch here is one validator, which
  // is two algod/Nodely calls per pool, so the ceiling is well below the algod default.
  // Metered against algod because it serves the balance read; Nodely failures are swallowed
  // by fetchNodelyVotingPerf and never surface here to learn from.
  const queuedMetricsQueries = useQueuedQueries(metricsQueries, {
    host: 'algod',
    maxBatchSize: 6,
  })

  // Combine all data synchronously
  const validators = React.useMemo(() => {
    const result: Validator[] = []

    for (let i = 0; i < validatorData.length; i++) {
      const { id, config, state, pools, nodePoolAssignment } = validatorData[i]

      // Create base validator
      const baseValidator = createBaseValidator({
        id,
        config,
        state,
        pools,
        nodePoolAssignment,
      })

      // Add enrichment data if available
      if (baseValidator.config.rewardTokenId > 0) {
        const rewardToken = rewardTokenQueries.data.find(
          (asset) => asset?.index === baseValidator.config.rewardTokenId,
        )
        if (rewardToken) {
          baseValidator.rewardToken = rewardToken
        }
      }

      if (baseValidator.config.entryGatingType === GatingType.AssetId) {
        baseValidator.gatingAssets = baseValidator.config.entryGatingAssets
          .map((assetId) => gatingAssetQueries.data.find((asset) => asset?.index === assetId))
          .filter(Boolean) as algosdk.modelsv2.Asset[]
      }

      if (baseValidator.config.nfdForInfo > 0) {
        const nfd = nfdQueries.data.find(
          (result) => result?.appID === Number(baseValidator.config.nfdForInfo),
        )
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
      const metrics = queuedMetricsQueries.data[i]
      if (metrics) {
        baseValidator.rewardsBalance = metrics.rewardsBalance
        baseValidator.roundsSinceLastPayout = metrics.roundsSinceLastPayout
        baseValidator.apy = metrics.apy
        baseValidator.extDeposits = metrics.extDeposits
      }

      result.push(baseValidator)
    }

    return result
  }, [
    validatorData,
    rewardTokenQueries.data,
    gatingAssetQueries.data,
    nfdQueries.data,
    nodelyPerfQuery.data,
    queuedMetricsQueries.data,
  ])

  return {
    validators,
    isLoading: allValidatorsQuery.isLoading,
    error: allValidatorsQuery.error,
  }
}
