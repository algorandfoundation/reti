import { AlgoAmount } from '@algorandfoundation/algokit-utils/types/amount'
import { useQuery } from '@tanstack/react-query'
import { ProgressBar } from '@tremor/react'
import { Copy } from 'lucide-react'
import { nfdLookupQueryOptions } from '@/api/queries'
import { AlgoDisplayAmount } from '@/components/AlgoDisplayAmount'
import { Loading } from '@/components/Loading'
import { NfdDisplay } from '@/components/NfdDisplay'
import { Button } from '@/components/ui/button'
import { Constraints } from '@/contracts/ValidatorRegistryClient'
import { LocalPoolInfo, Validator } from '@/interfaces/validator'
import { copyToClipboard } from '@/utils/copyToClipboard'
import { ellipseAddressJsx } from '@/utils/ellipseAddress'
import { ExplorerLink } from '@/utils/explorer'
import { roundToFirstNonZeroDecimal } from '@/utils/format'
import { nodeNumForPoolId } from '@/utils/pools'
import { LinkPoolToNfdModal } from './LinkPoolToNfdModal'

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

  // @todo: clean this way up
  const numPools = validator.state.numPools
  const hardMaxDividedBetweenPools =
    numPools > 0 ? constraints.maxAlgoPerValidator / BigInt(numPools) : BigInt(0)
  const maxMicroalgoPerPool =
    validator.config.maxAlgoPerPool == BigInt(0)
      ? hardMaxDividedBetweenPools
      : hardMaxDividedBetweenPools < validator.config.maxAlgoPerPool
        ? hardMaxDividedBetweenPools
        : validator.config.maxAlgoPerPool
  const maxAlgoPerPool = Number(maxMicroalgoPerPool / BigInt(1e6))
  const selectedPoolAlgoStake =
    poolInfo === null ? 0 : AlgoAmount.MicroAlgos(poolInfo.totalAlgoStaked).algos
  const selectedPoolPercent =
    poolInfo === null
      ? 0
      : roundToFirstNonZeroDecimal((selectedPoolAlgoStake / maxAlgoPerPool) * 100)
  const totalPercent = roundToFirstNonZeroDecimal(
    (Number(validator.state.totalAlgoStaked) / Number(constraints.maxAlgoPerValidator)) * 100,
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
                <div className="w-full mt-1">
                  <p className="text-tremor-default text-stone-500 dark:text-stone-400 flex items-center justify-between">
                    <span>
                      <AlgoDisplayAmount
                        amount={validator.state.totalAlgoStaked}
                        microalgos
                        maxLength={5}
                        compactPrecision={2}
                        mutedRemainder
                        className="font-mono text-foreground"
                      />{' '}
                      &bull; {totalPercent}%
                    </span>
                    <AlgoDisplayAmount
                      amount={constraints.maxAlgoPerValidator}
                      microalgos
                      maxLength={5}
                      compactPrecision={2}
                      mutedRemainder
                      className="font-mono"
                    />
                  </p>
                  <ProgressBar value={totalPercent} color="rose" className="mt-3" />
                </div>
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
              <div className="w-full mt-1">
                <p className="text-tremor-default text-tremor-content dark:text-dark-tremor-content flex items-center justify-between">
                  <span>
                    <AlgoDisplayAmount
                      amount={poolInfo.totalAlgoStaked}
                      microalgos
                      maxLength={5}
                      compactPrecision={2}
                      mutedRemainder
                      className="font-mono text-foreground"
                    />{' '}
                    &bull; {selectedPoolPercent}%
                  </span>
                  <AlgoDisplayAmount
                    amount={maxAlgoPerPool}
                    maxLength={5}
                    compactPrecision={2}
                    mutedRemainder
                    className="font-mono"
                  />
                </p>
                <ProgressBar value={selectedPoolPercent} color="rose" className="mt-3" />
              </div>
            </dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
