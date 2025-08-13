import { BarList } from '@tremor/react'
import { AlgoDisplayAmount } from '@/components/AlgoDisplayAmount'
import { ScrollArea } from '@/components/ui/scroll-area'
import { StakerChartData } from '@/interfaces/staking'
import { cn } from '@/utils/ui'

interface StakersListProps {
  chartData: StakerChartData[]
}

export function StakersList({ chartData }: StakersListProps) {
  const valueFormatter = (v: number) => (
    <AlgoDisplayAmount
      amount={v}
      microalgos
      maxLength={13}
      compactPrecision={2}
      trim={false}
      mutedRemainder
      className="font-mono"
    />
  )

  if (chartData.length === 0) {
    return null
  }

  return (
    <ScrollArea
      className={cn('rounded-lg border', {
        'h-64': chartData.length > 6,
        'sm:h-96': chartData.length > 9,
      })}
    >
      <div className="p-2 pr-6">
        <BarList
          data={chartData}
          valueFormatter={valueFormatter}
          className="font-mono underline-offset-4"
          showAnimation
        />
      </div>
    </ScrollArea>
  )
}
