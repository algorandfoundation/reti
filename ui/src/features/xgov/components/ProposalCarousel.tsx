import * as React from 'react'
import { Carousel, CarouselApi, CarouselContent, CarouselItem } from '@/components/ui/carousel'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export type ProposalCarouselControls = {
  scrollPrev: () => void
  scrollNext: () => void
  scrollTo: (index: number) => void
  selected: () => number
  canScrollPrev: () => boolean
  canScrollNext: () => boolean
}

export type ProposalCarouselProps<T> = {
  items: T[]
  renderItem: (item: T, index: number) => React.ReactNode
  index: number
  onIndexChange: (index: number) => void
  /** Called once Embla is ready; gives animated controls for Nav */
  onReady?: (controls: ProposalCarouselControls) => void
}

export function ProposalCarousel<T>({
  items,
  renderItem,
  index,
  onIndexChange,
  onReady,
}: ProposalCarouselProps<T>) {
  const [api, setApi] = React.useState<CarouselApi | null>(null)
  const total = items.length

  // Expose animated controls for external Nav
  React.useEffect(() => {
    if (!api) return
    const controls: ProposalCarouselControls = {
      scrollPrev: () => api.scrollPrev(),
      scrollNext: () => api.scrollNext(),
      scrollTo: (i: number) => api.scrollTo(i),
      selected: () => api.selectedScrollSnap(),
      canScrollPrev: () => api.canScrollPrev(),
      canScrollNext: () => api.canScrollNext(),
    }
    onReady?.(controls)
  }, [api, onReady])

  // Keep Embla in sync when the controlled index changes (animated)
  React.useEffect(() => {
    if (!api) return
    const current = api.selectedScrollSnap()
    if (index !== current) api.scrollTo(index)
  }, [index, api])

  // Report selection changes from user interactions (swipe, drag, keys)
  React.useEffect(() => {
    if (!api) return
    const onSelect = () => {
      const sel = api.selectedScrollSnap()
      if (sel !== index) onIndexChange(sel)
    }
    onSelect()
    api.on('select', onSelect)
    return () => {
      api.off('select', onSelect)
    }
  }, [api, index, onIndexChange])

  if (!total) return null

  return (
    <div className="relative">
      <Carousel
        setApi={setApi}
        opts={{ align: 'start', loop: true, slidesToScroll: 2, containScroll: 'trimSnaps' }}
      >
        <CarouselContent>
          {items.flatMap((item, i) => [
            <CarouselItem key={`real-${i}`} className="basis-full">
              {renderItem(item, i)}
            </CarouselItem>,
            i < items.length - 1 ? (
              <CarouselItem
                key={`spacer-${i}`}
                aria-hidden
                className="basis-[8px] shrink-0 pointer-events-none"
              />
            ) : null,
          ])}
        </CarouselContent>
      </Carousel>
      {total > 1 && (
        <div className="absolute inset-y-0 left-0 right-0 @xl:hidden z-10 pointer-events-none">
          <div className="h-full flex items-center justify-between -mx-4">
            <button
              type="button"
              onClick={() => api?.scrollPrev()}
              className="pointer-events-auto p-2 rounded-full bg-black/35 text-white shadow-md backdrop-blur"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              onClick={() => api?.scrollNext()}
              className="pointer-events-auto p-2 rounded-full bg-black/35 text-white shadow-md backdrop-blur"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProposalCarousel
