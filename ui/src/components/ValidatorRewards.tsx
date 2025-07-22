import { useQuery, useQueryClient } from '@tanstack/react-query'
import { validatorMetricsQueryOptions } from '@/api/queries'
import { AlgoDisplayAmount } from '@/components/AlgoDisplayAmount'
import { Skeleton } from '@/components/ui/skeleton'
import { Validator } from '@/interfaces/validator'

interface ValidatorRewardsProps {
  validator: Validator
}

export function ValidatorRewards({ validator }: ValidatorRewardsProps) {
  const queryClient = useQueryClient()
  const metricsQuery = useQuery(validatorMetricsQueryOptions(validator.id, queryClient))

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
      <AlgoDisplayAmount
        amount={metricsQuery.data?.rewardsBalance ?? 0n}
        microalgos
        trim={false}
        maxLength={6}
        compactPrecision={2}
      />
    </div>
  )
}
