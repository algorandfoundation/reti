import { Check, X } from 'lucide-react'
import { Tooltip } from '@/components/Tooltip'
import * as React from 'react'
import { Validator } from '@/interfaces/validator'
import { getApplicationAddress } from 'algosdk'
import { useXGovs } from '../hooks/useXGovs'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/utils/ui'

interface XGovIndicatorProps {
  validator: Validator
  poolId?: bigint
  className?: string
}

export function XGovIndicator({ validator, poolId, className }: XGovIndicatorProps) {
  const pools = React.useMemo(
    () => validator.pools.map((p) => getApplicationAddress(p.poolAppId).toString()),
    [validator.pools],
  )

  const { data, isLoading, isError } = useXGovs(pools)

  if (pools.length === 0) return <span className="text-muted-foreground">--</span>
  if (isLoading) return <Skeleton width={24} height={16} />
  if (isError || !data) return <span className="text-muted-foreground">--</span>

  const isXGov = poolId ? !!data.get(pools[Number(poolId - 1n)]) : data.size === pools.length

  const content = `${poolId ? 'Pool' : 'Validator'} ${
    isXGov ? 'is participating in xGov' : 'is not participating in xGov'
  }`

  return (
    <Tooltip content={content}>
      {isXGov ? (
        <Check className={cn('h-5 w-5 text-algo-blue dark:text-algo-teal', className)} />
      ) : (
        <X className={cn('h-5 w-5 text-algo-blue dark:text-algo-teal', className)} />
      )}
    </Tooltip>
  )
}
