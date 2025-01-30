import { useQuery } from '@tanstack/react-query'
import * as React from 'react'
import { nfdQueryOptions } from '@/api/queries'
import { Nfd } from '@/interfaces/nfd'
import { Tooltip } from '@/components/Tooltip'
import { getNfdAvatarUrl, getNfdProfileUrl } from '@/utils/nfd'
import { cn } from '@/utils/ui'

// 1x1 transparent PNG
const TRANSPARENT_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

interface NfdDisplayBaseProps {
  nfd: Nfd
  className?: string
  avatarClassName?: string
  link?: boolean
  truncate?: boolean
  tooltip?: boolean
  avatarOnly?: boolean
}

const NfdDisplayBase = React.memo(
  function NfdDisplayBase({
    nfd,
    className,
    avatarClassName,
    link = false,
    truncate = false,
    tooltip = false,
    avatarOnly = false,
  }: NfdDisplayBaseProps) {
    const [imageError, setImageError] = React.useState(false)
    const avatarUrl = React.useMemo(() => {
      const url = getNfdAvatarUrl(nfd)
      if (imageError || url.startsWith('ipfs://')) {
        return TRANSPARENT_PNG
      }
      return url
    }, [nfd.name, imageError])

    const avatar = (
      <div className={cn('relative h-6 w-6 rounded-full bg-muted', avatarClassName)}>
        <img
          src={avatarUrl}
          className="absolute inset-0 rounded-full"
          alt={nfd.name}
          onError={() => setImageError(true)}
        />
      </div>
    )

    if (avatarOnly) {
      return avatar
    }

    const content = (
      <div className="flex items-center gap-x-1.5 text-sm font-semibold text-foreground">
        <div className="flex-shrink-0">{avatar}</div>
        <div className={cn({ truncate })}>{nfd.name}</div>
      </div>
    )

    const wrappedContent = link ? (
      <a
        href={getNfdProfileUrl(nfd.name)}
        target="_blank"
        rel="noreferrer"
        className={cn('link underline-offset-4', className)}
      >
        {content}
      </a>
    ) : (
      <div className={className}>{content}</div>
    )

    if (tooltip) {
      return <Tooltip content={nfd.name}>{wrappedContent}</Tooltip>
    }

    return wrappedContent
  },
  (prevProps, nextProps) => {
    return (
      prevProps.avatarClassName === nextProps.avatarClassName &&
      prevProps.nfd.name === nextProps.nfd.name &&
      prevProps.link === nextProps.link &&
      prevProps.truncate === nextProps.truncate &&
      prevProps.tooltip === nextProps.tooltip &&
      prevProps.avatarOnly === nextProps.avatarOnly
    )
  },
)

type NfdDisplayProps = (
  | {
      nfd: Nfd
      nameOrId?: never
    }
  | {
      nfd?: never
      nameOrId: string | bigint
    }
) & {
  className?: string
  avatarClassName?: string
  link?: boolean
  truncate?: boolean
  tooltip?: boolean
  avatarOnly?: boolean
}

const NfdDisplay = React.memo(function NfdDisplay({
  nfd: nfdProp,
  nameOrId,
  ...props
}: NfdDisplayProps) {
  const { data: nfdData, isLoading, error } = useQuery(nfdQueryOptions(nameOrId || ''))

  if (nfdProp) {
    return <NfdDisplayBase nfd={nfdProp} {...props} />
  }

  if (isLoading) {
    return <span className="text-sm">Loading...</span>
  }

  if (error || !nfdData) {
    return <span className="text-sm text-red-500">Error fetching NFD</span>
  }

  return <NfdDisplayBase nfd={nfdData} {...props} />
})

export { NfdDisplay }
