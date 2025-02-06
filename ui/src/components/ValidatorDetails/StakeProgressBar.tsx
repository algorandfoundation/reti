import { ProgressBar } from '@tremor/react'
import { AlgoDisplayAmount } from '@/components/AlgoDisplayAmount'
import { roundToFirstNonZeroDecimal } from '@/utils/format'

interface StakeProgressBarProps {
  currentAmount: bigint
  maxAmount: bigint
  className?: string
}

export function StakeProgressBar({ currentAmount, maxAmount, className }: StakeProgressBarProps) {
  const currentAlgos = Number(currentAmount) / 1e6
  const maxAlgos = Number(maxAmount) / 1e6
  const percent = roundToFirstNonZeroDecimal((currentAlgos / maxAlgos) * 100)

  return (
    <div className={className}>
      <p className="text-tremor-default text-stone-500 dark:text-stone-400 flex items-center justify-between">
        <span>
          <AlgoDisplayAmount
            amount={currentAmount}
            microalgos
            maxLength={5}
            compactPrecision={2}
            mutedRemainder
            className="font-mono text-foreground"
          />{' '}
          &bull; {percent}%
        </span>
        <AlgoDisplayAmount
          amount={maxAmount}
          microalgos
          maxLength={5}
          compactPrecision={2}
          mutedRemainder
          className="font-mono"
        />
      </p>
      <ProgressBar value={percent} color="rose" className="mt-3" />
    </div>
  )
}
