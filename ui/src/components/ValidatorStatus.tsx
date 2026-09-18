import { useQuery, useQueryClient } from '@tanstack/react-query'
import { validatorMetricsQueryOptions } from '@/api/queries'
import { PerfIndicator } from '@/components/PerfIndicator'
import { TrafficLight } from '@/components/TrafficLight'
import { Skeleton } from '@/components/ui/skeleton'
import { Indicator } from '@/constants/indicator'
import { useBlockTime } from '@/hooks/useBlockTime'
import { Validator } from '@/interfaces/validator'
import { formatDuration } from '@/utils/dayjs'
import { formatAmount } from '@/utils/format'

interface ValidatorRewardsProps {
  validator: Validator
}

export function ValidatorStatus({ validator }: ValidatorRewardsProps) {
  const queryClient = useQueryClient()

  // Observe only. Fetching is owned by the metered queue in useValidators - a live query per
  // row would have all ~225 validators bypass that queue and hit algod at once on mount.
  const metricsQuery = useQuery({
    ...validatorMetricsQueryOptions(validator.id, queryClient, {
      pools: validator.pools,
      totalAlgoStaked: validator.state.totalAlgoStaked,
      epochRoundLength: validator.config.epochRoundLength,
    }),
    enabled: false,
  })

  const blockTime = useBlockTime()

  if (metricsQuery.isPending) {
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
  // Absence is checked directly rather than inferred from `Number(undefined)` being NaN:
  // "Nodely has no row for this validator" and "this validator is performing badly" are
  // different states, and a lookup that silently stops matching must not read as the latter.
  const perfScore = validator.perf
  let perfIndicator: Indicator
  let perfTooltip: string
  if (perfScore === undefined) {
    perfIndicator = Indicator.Error
    perfTooltip = 'Not active'
  } else {
    perfIndicator = perfScore >= 0.7 ? Indicator.Normal : Indicator.Watch
    perfTooltip = `${formatAmount(perfScore * 100, { precision: 1 })}%`
  }

  // `undefined` means no metrics for this validator; 0 means it paid out this round.
  const roundsSinceLastPayout =
    metricsQuery.data?.roundsSinceLastPayout === undefined
      ? undefined
      : Number(metricsQuery.data.roundsSinceLastPayout)

  let statusIndicator = Indicator.Normal
  let statusTooltip = ''
  if (roundsSinceLastPayout === undefined || roundsSinceLastPayout >= 1200) {
    statusIndicator = Indicator.Error
    statusTooltip = `Payouts stopped, behind ${formatDuration(
      (roundsSinceLastPayout ?? 0) * blockTime.ms,
    )}`
  } else if (roundsSinceLastPayout >= 210) {
    statusIndicator = Indicator.Watch
    statusTooltip = `Payouts behind ${formatDuration(roundsSinceLastPayout * blockTime.ms)}`
  }

  return (
    <span className="flex items-center space-x-2">
      <PerfIndicator tooltipContent={perfTooltip} indicator={perfIndicator} showGreen={true} />
      <span className="h-5 w-px bg-gray-300 dark:bg-gray-700"></span>
      <TrafficLight tooltipContent={statusTooltip} indicator={statusIndicator} showGreen={true} />
    </span>
  )
}
