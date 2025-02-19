import { useQuery } from '@tanstack/react-query'
import { Copy } from 'lucide-react'
import { nfdLookupQueryOptions } from '@/api/queries'
import { Loading } from '@/components/Loading'
import { NfdDisplay } from '@/components/NfdDisplay'
import { Button } from '@/components/ui/button'
import { Constraints } from '@/contracts/ValidatorRegistryClient'
import { LocalPoolInfo, Validator } from '@/interfaces/validator'
import { copyToClipboard } from '@/utils/copyToClipboard'
import { ellipseAddressJsx } from '@/utils/ellipseAddress'
import { ExplorerLink } from '@/utils/explorer'
import { nodeNumForPoolId } from '@/utils/pools'
import { LinkPoolToNfdModal } from './LinkPoolToNfdModal'
import { StakeProgressBar } from './StakeProgressBar'

interface StakingPoolInfoProps {
  validator: Validator
  constraints: Constraints
  poolInfo: LocalPoolInfo | null
  poolName: string
  isOwner: boolean
}

export function StakingPoolInfo({
  validator,
  constraints,
  poolInfo,
  poolName,
  isOwner,
}: StakingPoolInfoProps) {
  const poolNfdQuery = useQuery(
    nfdLookupQueryOptions(poolInfo?.poolAddress || null, { view: 'thumbnail' }, { cache: false }),
  )

  const renderSeparator = () => {
    if (!poolInfo) {
      return null
    }

    // If pool has no NFD, show separator only if user is owner
    if (poolNfdQuery.data === null && !isOwner) {
      return null
    }

    return <span className="h-9 w-px bg-stone-900/15 dark:bg-white/15" />
  }

  const renderPoolNfd = () => {
    if (!poolInfo) {
      return null
    }

    if (poolNfdQuery.isLoading) {
      return <Loading size="sm" className="mx-8" inline />
    }

    if (poolNfdQuery.error) {
      return <span className="text-destructive">Failed to load NFD</span>
    }

    if (!poolNfdQuery.data) {
      if (!isOwner) {
        return null
      }

      return (
        <LinkPoolToNfdModal
          poolId={poolInfo.poolId}
          poolAppId={poolInfo.poolAppId}
          disabled={import.meta.env.VITE_ALGOD_NETWORK === 'localnet'}
        />
      )
    }

    return (
      <div className="truncate">
        <NfdDisplay nfd={poolNfdQuery.data} truncate link />
      </div>
    )
  }

  if (!poolInfo) {
    return (
      <div className="w-full">
        <div className="py-6">
          <h4 className="text-xl font-semibold leading-none tracking-tight">All Pools</h4>
        </div>
        <div className="border-t border-foreground-muted">
          <dl className="divide-y divide-foreground-muted">
            <div className="py-4 grid grid-cols-2 gap-4">
              <dt className="text-sm font-medium leading-6 text-muted-foreground">Total Pools</dt>
              <dd className="flex items-center gap-x-2 text-sm leading-6">
                {validator.state.numPools}
              </dd>
            </div>
            {/* <div className="py-4 grid grid-cols-2 gap-4">
              <dt className="text-sm font-medium leading-6 text-muted-foreground">Avg APY</dt>
              <dd className="flex items-center gap-x-2 text-sm leading-6">
                {validator.apy ? (
                  `${validator.apy}%`
                ) : (
                  <span className="text-muted-foreground">--</span>
                )}
              </dd>
            </div> */}
            <div className="py-4 grid grid-cols-2 gap-4">
              <dt className="text-sm font-medium leading-6 text-muted-foreground">Total Stakers</dt>
              <dd className="flex items-center gap-x-2 text-sm leading-6">
                {validator.state.totalStakers.toString()}
              </dd>
            </div>
            <div className="py-4">
              <dt className="text-sm font-medium leading-6 text-muted-foreground">Total Staked</dt>
              <dd className="flex items-center gap-x-2 text-sm leading-6">
                <StakeProgressBar
                  currentAmount={validator.state.totalAlgoStaked}
                  maxAmount={constraints.maxAlgoPerValidator}
                  className="w-full mt-1"
                />
              </dd>
            </div>
          </dl>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-center gap-x-4 h-9 my-4 sm:justify-start">
        <h4 className="text-xl font-semibold leading-none tracking-tight whitespace-nowrap">
          {poolName}
        </h4>
        {renderSeparator()}
        {renderPoolNfd()}
      </div>
      <div className="border-t border-foreground-muted">
        <dl className="divide-y divide-foreground-muted">
          <div className="py-4 grid grid-cols-2 gap-4">
            <dt className="text-sm font-medium leading-6 text-muted-foreground">Address</dt>
            <dd className="flex items-center gap-x-2 text-sm">
              {poolInfo.poolAddress ? (
                <>
                  <a
                    href={ExplorerLink.account(poolInfo.poolAddress)}
                    target="_blank"
                    rel="noreferrer"
                    className="link font-mono whitespace-nowrap"
                  >
                    {ellipseAddressJsx(poolInfo.poolAddress)}
                  </a>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="group h-8 w-8 -my-1"
                    data-clipboard-text={poolInfo.poolAddress}
                    onClick={copyToClipboard}
                  >
                    <Copy className="h-4 w-4 opacity-60 transition-opacity group-hover:opacity-100" />
                  </Button>
                </>
              ) : (
                <span className="text-muted-foreground">--</span>
              )}
            </dd>
          </div>

          <div className="py-4 grid grid-cols-2 gap-4">
            <dt className="text-sm font-medium leading-6 text-muted-foreground">Node Number</dt>
            <dd className="flex items-center gap-x-2 text-sm">
              <span className="font-mono">
                {nodeNumForPoolId(poolInfo.poolAppId, validator.nodePoolAssignment)}
              </span>
            </dd>
          </div>

          <div className="py-4 grid grid-cols-2 gap-4">
            <dt className="text-sm font-medium leading-6 text-muted-foreground">Algod version</dt>
            <dd className="flex items-center gap-x-2 text-sm">
              {poolInfo.algodVersion ? (
                <span className="font-mono">{poolInfo.algodVersion}</span>
              ) : (
                <span className="text-muted-foreground">--</span>
              )}
            </dd>
          </div>

          {/* <div className="py-4 grid grid-cols-2 gap-4">
            <dt className="text-sm font-medium leading-6 text-muted-foreground">APY</dt>
            <dd className="flex items-center gap-x-2 text-sm leading-6">
              {selectedPoolApy ? (
                `${selectedPoolApy}%`
              ) : (
                <span className="text-muted-foreground">--</span>
              )}
            </dd>
          </div> */}

          <div className="py-4 grid grid-cols-2 gap-4">
            <dt className="text-sm font-medium leading-6 text-muted-foreground">Stakers</dt>
            <dd className="flex items-center gap-x-2 text-sm leading-6">
              {poolInfo.totalStakers.toString()}
            </dd>
          </div>

          <div className="py-4">
            <dt className="text-sm font-medium leading-6 text-muted-foreground">Staked</dt>
            <dd className="flex items-center gap-x-2 text-sm leading-6">
              <StakeProgressBar
                currentAmount={poolInfo.totalAlgoStaked}
                maxAmount={validator.config.maxAlgoPerPool || constraints.maxAlgoPerPool}
                className="w-full mt-1"
              />
            </dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
