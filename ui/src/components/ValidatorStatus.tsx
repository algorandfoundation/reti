import { PerfIndicator } from '@/components/PerfIndicator'
import { TrafficLight } from '@/components/TrafficLight'
import { Skeleton } from '@/components/ui/skeleton'
import { Indicator } from '@/constants/indicator'
import { useBlockTime } from '@/hooks/useBlockTime'
import { Validator } from '@/interfaces/validator'
import { formatDuration } from '@/utils/dayjs'

interface ValidatorRewardsProps {
  validator: Validator
}

export function ValidatorStatus({ validator }: ValidatorRewardsProps) {
  const blockTime = useBlockTime()

  if (validator.apy === undefined) {
    return (
      <div className="flex items-center">
        <Skeleton width={48} height={16} />
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

  const roundsSinceLastPayout = Number(validator?.roundsSinceLastPayout ?? 0)
  let statusIndicator = Indicator.Normal
  let statusTooltooltip = ''
  if (!roundsSinceLastPayout || roundsSinceLastPayout >= 1200n) {
    statusIndicator = Indicator.Error
    statusTooltooltip = `Payouts stopped, behind ${formatDuration(
      Number(validator?.roundsSinceLastPayout ?? 0) * blockTime.ms,
    )}`
  } else if (roundsSinceLastPayout >= 210n) {
    statusIndicator = Indicator.Watch
    statusTooltooltip = `Payouts behind ${formatDuration(
      Number(validator?.roundsSinceLastPayout ?? 0) * blockTime.ms,
    )}`
  } else if (roundsSinceLastPayout < 21n) {
    statusIndicator = Indicator.Normal
    statusTooltooltip = ''
  }

  return (
    <span className="flex items-center space-x-2">
      <PerfIndicator tooltipContent={perfTooltip} indicator={perfIndicator} showGreen={true} />
      <span className="h-5 w-px bg-gray-300 dark:bg-gray-700"></span>
      <TrafficLight
        tooltipContent={statusTooltooltip}
        indicator={statusIndicator}
        showGreen={true}
      />
    </span>
  )
}
