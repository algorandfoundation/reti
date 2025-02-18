import { useQuery, useQueryClient } from '@tanstack/react-query'
import { validatorMetricsQueryOptions } from '@/api/queries'
import { Skeleton } from '@/components/ui/skeleton'
import { Validator } from '@/interfaces/validator'
import { useBlockTime } from '@/hooks/useBlockTime'
import { formatDuration } from '@/utils/dayjs'
import { Indicator } from '@/constants/indicator'
import { TrafficLight } from '@/components/TrafficLight'

interface ValidatorRewardsProps {
  validator: Validator
}

export function ValidatorStatus({ validator }: ValidatorRewardsProps) {
  const queryClient = useQueryClient()
  const metricsQuery = useQuery(validatorMetricsQueryOptions(validator.id, queryClient))

  const blockTime = useBlockTime()

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
  let perfIndicator = Indicator.Normal
  if (perfScore >= 0.7) {
    perfIndicator = Indicator.Normal
  } else if (perfScore < 0.7) {
    perfIndicator = Indicator.Watch
  } else {
    perfIndicator = Indicator.Error
    perfTooltip = 'Not active'
  }

  const roundsSinceLastPayout = Number(metricsQuery.data?.roundsSinceLastPayout ?? 0)
  let statusIndicator = Indicator.Normal
  let statusTooltooltip = ''
  if (!roundsSinceLastPayout || roundsSinceLastPayout >= 1200n) {
    statusIndicator = Indicator.Error
    statusTooltooltip = `Payouts stopped, behind ${formatDuration(
      Number(metricsQuery.data?.roundsSinceLastPayout ?? 0) * blockTime.ms,
    )}`
  } else if (roundsSinceLastPayout >= 210n) {
    statusIndicator = Indicator.Watch
    statusTooltooltip = `Payouts behind ${formatDuration(
      Number(metricsQuery.data?.roundsSinceLastPayout ?? 0) * blockTime.ms,
    )}`
  } else if (roundsSinceLastPayout < 21n) {
    statusIndicator = Indicator.Normal
    statusTooltooltip = ''
  }

  return (
    <span className="flex items-center space-x-2">
      <TrafficLight tooltipContent={perfTooltip} indicator={perfIndicator} showGreen={true} />
      <span className="h-5 w-px bg-gray-300"></span>
      <TrafficLight
        tooltipContent={statusTooltooltip}
        indicator={statusIndicator}
        showGreen={true}
      />
    </span>
  )
}
