import { Button } from '@/components/ui/button'
import { cn } from '@/utils/ui'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export type ProposalCarouselNavProps = {
  currentIndex: number
  total: number
  go: (dir: 1 | -1) => void
  className?: string
}

export function ProposalCarouselNav({
  currentIndex,
  total,
  go,
  className,
}: ProposalCarouselNavProps) {
  const isDisabled = total === 1
  if (total === 0) return
  return (
    <div className={cn('flex flex-row items-center justify-between gap-2', className)}>
      <Button
        className="hidden @xl:inline-flex h-8 px-2 bg-white dark:bg-algo-black hover:bg-algo-blue dark:hover:bg-algo-teal hover:text-white dark:hover:text-algo-black text-algo-black dark:text-white border border-algo-blue dark:border-algo-teal"
        onClick={() => go(-1)}
        disabled={isDisabled}
      >
        <ChevronLeft className="h-5 w-5" />
      </Button>
      <div className="flex h-full items-center text-sm font-semibold tabular-nums">
        {currentIndex + 1} / {total}
      </div>
      <Button
        className="hidden @xl:inline-flex h-8 px-2 bg-white dark:bg-algo-black hover:bg-algo-blue dark:hover:bg-algo-teal hover:text-white dark:hover:text-algo-black text-algo-black dark:text-white border border-algo-blue dark:border-algo-teal"
        onClick={() => go(1)}
        disabled={isDisabled}
      >
        <ChevronRight className="h-5 w-5" />
      </Button>
    </div>
  )
}
