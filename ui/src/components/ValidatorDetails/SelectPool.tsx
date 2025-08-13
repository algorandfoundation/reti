import * as React from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LocalPoolInfo } from '@/interfaces/validator'
import { getPoolNameFromIndex } from '@/utils/pools'

interface SelectPoolProps {
  selectedPool: string
  onValueChange: (value: string) => void
  poolsInfo: LocalPoolInfo[]
  chartContainerRef: React.RefObject<HTMLDivElement>
}

export function SelectPool({
  selectedPool,
  onValueChange,
  poolsInfo,
  chartContainerRef,
}: SelectPoolProps) {
  // Simulate chart clicks when changing pools via dropdown
  const handleSelectValueChange = React.useCallback(
    (newValue: string) => {
      const previousValue = selectedPool
      const previousPool = getPoolNameFromIndex(previousValue)
      const newPool = getPoolNameFromIndex(newValue)

      if (chartContainerRef.current) {
        if (previousValue === 'all') {
          // Switching from 'All Pools' to a specific pool, click new pool to select
          simulateChartClick(chartContainerRef.current, newPool)
        } else if (newValue === 'all') {
          // Switching from a specific pool to 'All Pools', click previous pool to deselect
          simulateChartClick(chartContainerRef.current, previousPool)
        } else {
          // Switching between two specific pools, click previous pool to deselect then new pool to select
          simulateChartClick(chartContainerRef.current, previousPool)
          simulateChartClick(chartContainerRef.current, newPool)
        }
      }

      onValueChange(newValue)
    },
    [selectedPool, chartContainerRef, onValueChange],
  )

  return (
    <Select value={selectedPool} onValueChange={handleSelectValueChange}>
      <SelectTrigger className="-my-2.5 w-[120px]" aria-label="Select a pool">
        <SelectValue placeholder="Select a pool" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Pools</SelectItem>
        {poolsInfo.map((_, index) => (
          <SelectItem key={index} value={String(index)}>
            {getPoolNameFromIndex(index)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

// Helper function to simulate chart clicks
function simulateChartClick(container: HTMLDivElement, poolName: string) {
  const targetElement = container.querySelector(`path[name="${poolName}"]`) as SVGPathElement | null

  if (targetElement) {
    const clickEvent = new MouseEvent('click', {
      view: window,
      bubbles: true,
      cancelable: true,
    })
    targetElement.dispatchEvent(clickEvent)
  }
}
