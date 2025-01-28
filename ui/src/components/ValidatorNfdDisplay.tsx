import { Link } from '@tanstack/react-router'
import * as React from 'react'
import { Nfd } from '@/interfaces/nfd'
import { getNfdAvatarUrl } from '@/utils/nfd'
import { cn } from '@/utils/ui'

// 1x1 transparent PNG
const TRANSPARENT_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

interface ValidatorNfdDisplayProps {
  nfd: Nfd
  validatorId: number
  className?: string
  isSunsetted?: boolean
}

const ValidatorNfdDisplay = React.memo(
  function ValidatorNfdDisplay({
    nfd,
    validatorId,
    className,
    isSunsetted,
  }: ValidatorNfdDisplayProps) {
    const [imageError, setImageError] = React.useState(false)
    const avatarUrl = React.useMemo(() => {
      const url = getNfdAvatarUrl(nfd)
      // @todo: Handle IPFS URLs
      if (imageError || url.startsWith('ipfs://')) {
        return TRANSPARENT_PNG
      }
      return url
    }, [nfd.name, imageError])

    return (
      <Link
        to="/validators/$validatorId"
        params={{
          validatorId: String(validatorId),
        }}
        className={cn('link underline-offset-4 whitespace-nowrap truncate', className)}
        preload="intent"
      >
        <div className="flex items-center gap-x-1.5 text-sm font-semibold text-foreground">
          <div className="flex-shrink-0">
            <div
              className={cn('relative h-6 w-6 rounded-full bg-muted', {
                'opacity-50': isSunsetted,
              })}
            >
              <img
                src={avatarUrl}
                className="absolute inset-0 rounded-full"
                alt=""
                onError={() => setImageError(true)}
              />
            </div>
          </div>
          <div className="truncate">{nfd.name}</div>
        </div>
      </Link>
    )
  },
  (prevProps, nextProps) => {
    return (
      prevProps.validatorId === nextProps.validatorId &&
      prevProps.isSunsetted === nextProps.isSunsetted &&
      prevProps.nfd.name === nextProps.nfd.name
    )
  },
)

export { ValidatorNfdDisplay }
