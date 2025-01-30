import { Link } from '@tanstack/react-router'
import * as React from 'react'
import { NfdDisplay } from '@/components/NfdDisplay'
import { Nfd } from '@/interfaces/nfd'
import { cn } from '@/utils/ui'

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
    return (
      <Link
        to="/validators/$validatorId"
        params={{
          validatorId: String(validatorId),
        }}
        className={cn('link underline-offset-4 whitespace-nowrap truncate', className)}
        preload="intent"
      >
        <NfdDisplay nfd={nfd} avatarClassName={cn({ 'opacity-50': isSunsetted })} />
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
