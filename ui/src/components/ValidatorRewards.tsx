import { useQuery, useQueryClient } from '@tanstack/react-query'
import { validatorMetricsQueryOptions } from '@/api/queries'
import { Skeleton } from '@/components/ui/skeleton'
import { Validator } from '@/interfaces/validator'
import { useBlockTime } from '@/hooks/useBlockTime'
import { formatDuration } from '@/utils/dayjs'
import { Tooltip } from '@/components/Tooltip'

interface ValidatorRewardsProps {
  validator: Validator
}

export function ValidatorRewards({ validator }: ValidatorRewardsProps) {
  const queryClient = useQueryClient()
  const metricsQuery = useQuery(validatorMetricsQueryOptions(validator.id, queryClient))

  const blockTime = useBlockTime()
  // const epochLength = validator.config.epochRoundLength

  if (metricsQuery.isLoading) {
    return (
      <div className="flex items-center">
        <Skeleton width={48} height={16} />
      </div>
    )
  }

  if (metricsQuery.isError) {
    return (
      <div className="flex items-center text-destructive">
        <span className="text-sm">Error</span>
      </div>
    )
  }
  const perfScore = Number(validator.perf)
  let perfTooltip = `${perfScore * 100}%`
  let perfStr = ''
  if (perfScore >= 0.7) {
    perfStr = '✅'
    // } else if (perfScore >= 0.9) {
    //   perfStr = '☑️'
  } else if (perfScore < 0.7) {
    perfStr = `❌`
  } else {
    perfStr = '❌'
    perfTooltip = 'Not active'
  }

  const roundsSinceLastPayout = Number(metricsQuery.data?.roundsSinceLastPayout ?? 0)
  let statusStr = ''
  let statusTooltooltip = ''
  if (!roundsSinceLastPayout || roundsSinceLastPayout >= 1200n) {
    statusStr = '❌'
    statusTooltooltip = `Payouts stopped, behind ${formatDuration(
      Number(metricsQuery.data?.roundsSinceLastPayout ?? 0) * blockTime.ms,
    )}`
  } else if (roundsSinceLastPayout >= 210n) {
    statusStr = '☑️'
    statusTooltooltip = `Payouts behind ${formatDuration(
      Number(metricsQuery.data?.roundsSinceLastPayout ?? 0) * blockTime.ms,
    )}`
  } else if (roundsSinceLastPayout < 21n) {
    statusStr = '✅'
    statusTooltooltip = ''
  }

  return (
    <div className="flex items-center">
      <Tooltip content={perfTooltip}>
        <span>{perfStr}</span>
      </Tooltip>
      /
      <Tooltip content={statusTooltooltip}>
        <span>{statusStr}</span>
      </Tooltip>
    </div>
  )
}
