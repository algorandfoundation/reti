import { Tooltip } from '@/components/Tooltip'
import { Indicator } from '@/constants/indicator'
import { cn } from '@/utils/ui'

interface PerfIndicatorProps extends React.SVGProps<SVGSVGElement> {
  indicator: Indicator
  tooltipContent?: string | Partial<Record<Indicator, string>>
  className?: string
  showGreen?: boolean
}

export function PerfIndicator({
  indicator,
  tooltipContent = '',
  className,
  showGreen = false,
  ...props
}: PerfIndicatorProps) {
  const rotation = {
    [Indicator.Error]: -180,
    [Indicator.Normal]: 0,
    [Indicator.Watch]: -45,
    [Indicator.Warning]: -45,
    [Indicator.Max]: -180,
  }[indicator]

  const color = {
    [Indicator.Error]: 'text-red-500',
    [Indicator.Normal]: 'text-green-500',
    [Indicator.Watch]: 'text-yellow-500',
    [Indicator.Warning]: 'text-orange-500',
    [Indicator.Max]: 'text-red-500',
  }[indicator]

  const getTooltipContent = () => {
    if (typeof tooltipContent === 'string') {
      return tooltipContent
    }
    return tooltipContent[indicator]
  }

  const renderIndicator = () => (
    <svg
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn(color, className)}
      {...props}
    >
      <path
        d="m12 14 4-4"
        style={{
          transformOrigin: '12px 14px',
          transform: `rotate(${rotation}deg)`,
        }}
      />
      <path d="M3.34 19a10 10 0 1 1 17.32 0" />
    </svg>
  )

  if (indicator === Indicator.Normal && !showGreen) {
    return null
  }

  return (
    <div className="inline-flex items-center justify-center">
      {tooltipContent ? (
        <Tooltip content={getTooltipContent()}>{renderIndicator()}</Tooltip>
      ) : (
        renderIndicator()
      )}
    </div>
  )
}
