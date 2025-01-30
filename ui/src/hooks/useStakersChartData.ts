import { useQueries, useQuery } from '@tanstack/react-query'
import * as React from 'react'
import {
  nfdLookupQueryOptions,
  stakedInfoQueryOptions,
  validatorPoolsQueryOptions,
} from '@/api/queries'
import { StakedInfo } from '@/contracts/StakingPoolClient'
import { ExplorerLink } from '@/utils/explorer'
import { getNfdProfileUrl } from '@/utils/nfd'

interface UseChartDataProps {
  selectedPool: string
  validatorId: number
}

export function useStakersChartData({ selectedPool, validatorId }: UseChartDataProps) {
  const poolsInfoQuery = useQuery(validatorPoolsQueryOptions(validatorId))
  const poolsInfo = poolsInfoQuery.data || []

  const allStakedInfo = useQueries({
    queries: poolsInfo.map((pool) => stakedInfoQueryOptions(pool.poolAppId)),
  })

  const isLoading = poolsInfoQuery.isLoading || allStakedInfo.some((query) => query.isLoading)
  const isSuccess = poolsInfoQuery.isSuccess && allStakedInfo.every((query) => query.isSuccess)
  const isError = poolsInfoQuery.isError || allStakedInfo.some((query) => query.isError)

  const defaultMessage = isError ? 'An error occurred while loading staking data.' : undefined

  const errorMessage =
    poolsInfoQuery.error?.message ||
    allStakedInfo.find((query) => query.error)?.error?.message ||
    defaultMessage

  const stakerAddresses = React.useMemo(() => {
    if (!allStakedInfo) return []

    const addresses = new Set<string>()

    allStakedInfo.forEach((query, i) => {
      if (selectedPool !== 'all' && Number(selectedPool) !== i) return

      const stakers = query.data || []
      stakers.forEach((staker) => addresses.add(staker.account))
    })

    return Array.from(addresses)
  }, [allStakedInfo, selectedPool])

  const nfdQueries = useQueries({
    queries: stakerAddresses.map((address) => nfdLookupQueryOptions(address)),
  })

  const stakersChartData = React.useMemo(() => {
    if (!allStakedInfo) return []

    const stakerTotals: Record<string, StakedInfo> = {}
    const nfdMap = new Map(
      nfdQueries.map((query, index) => [stakerAddresses[index], query.data?.name]),
    )

    allStakedInfo.forEach((query, i) => {
      if (selectedPool !== 'all' && Number(selectedPool) !== i) return

      const stakers = query.data || []

      stakers.forEach((staker) => {
        const id = staker.account

        if (!stakerTotals[id]) {
          stakerTotals[id] = {
            ...staker,
            balance: BigInt(0),
            totalRewarded: BigInt(0),
            rewardTokenBalance: BigInt(0),
          }
        }
        stakerTotals[id].balance += staker.balance
        stakerTotals[id].totalRewarded += staker.totalRewarded
        stakerTotals[id].rewardTokenBalance += staker.rewardTokenBalance
      })
    })

    return Object.values(stakerTotals).map((staker) => {
      const nfdName = nfdMap.get(staker.account)
      return {
        name: nfdName || staker.account,
        value: Number(staker.balance),
        href: nfdName ? getNfdProfileUrl(nfdName) : ExplorerLink.account(staker.account),
      }
    })
  }, [allStakedInfo, selectedPool, nfdQueries, stakerAddresses])

  return {
    stakersChartData,
    poolsInfo,
    isLoading,
    isError,
    errorMessage,
    isSuccess,
  }
}
