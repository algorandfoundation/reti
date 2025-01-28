import { useQuery, useQueryClient } from '@tanstack/react-query'
import { validatorMetricsQueryOptions } from '@/api/queries'
import { AlgoDisplayAmount } from '@/components/AlgoDisplayAmount'
import { Indicator } from '@/constants/indicator'
import { TrafficLight } from '@/components/TrafficLight'
import { Skeleton } from '@/components/ui/skeleton'
import { Validator } from '@/interfaces/validator'
import { calculateValidatorHealth } from '@/utils/contracts'

interface ValidatorRewardsProps {
  validator: Validator
}

export function ValidatorRewards({ validator }: ValidatorRewardsProps) {
  const queryClient = useQueryClient()
  const metricsQuery = useQuery(validatorMetricsQueryOptions(validator.id, queryClient))

  const tooltipContent = {
    [Indicator.Normal]: 'Fully operational',
    [Indicator.Watch]: 'Payouts Lagging',
    [Indicator.Warning]: 'Payouts Stopped',
    [Indicator.Error]: 'Rewards not compounding',
  }

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

  return (
    <div className="flex items-center">
      <TrafficLight
        indicator={calculateValidatorHealth(metricsQuery.data?.roundsSinceLastPayout)}
        tooltipContent={tooltipContent}
        className="mr-2"
      />
      <AlgoDisplayAmount amount={metricsQuery.data?.rewardsBalance ?? 0n} microalgos />
    </div>
  )
}
