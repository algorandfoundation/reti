import { useQuery } from '@tanstack/react-query'
import { EventProps } from '@tremor/react'
import { useWallet } from '@txnlab/use-wallet-react'
import * as React from 'react'
import { validatorNodePoolAssignmentsQueryOptions } from '@/api/queries'
import { AddPoolModal } from '@/components/AddPoolModal'
import { AddStakeModal } from '@/components/AddStakeModal'
import { ErrorAlert } from '@/components/ErrorAlert'
import { Loading } from '@/components/Loading'
import { PoolIcon } from '@/components/PoolIcon'
import { Button } from '@/components/ui/button'
import { Card, CardTitle, CardHeader, CardContent, CardFooter } from '@/components/ui/card'
import { UnstakeModal } from '@/components/UnstakeModal'
import { Constraints } from '@/contracts/ValidatorRegistryClient'
import { useStakersChartData } from '@/hooks/useStakersChartData'
import { StakerValidatorData } from '@/interfaces/staking'
import { Validator } from '@/interfaces/validator'
import {
  isStakingDisabled,
  isSunsetted,
  isSunsetting,
  isUnstakingDisabled,
  validatorHasAvailableSlots,
} from '@/utils/contracts'
import { convertFromBaseUnits } from '@/utils/format'
import { getPoolIndexFromName, getPoolNameFromIndex } from '@/utils/pools'
import { Details } from './Details'
import { Highlights } from './Highlights'
import { PoolsChart } from './PoolsChart'
import { SelectPool } from './SelectPool'
import { StakingPoolInfo } from './StakingPoolInfo'
import { StakersList } from './StakersList'
import { SunsetNotice } from './SunsetNotice'

interface ValidatorDetailsProps {
  validator: Validator
  stakesByValidator: StakerValidatorData[]
  constraints: Constraints
}

export function ValidatorDetails({
  validator,
  constraints,
  stakesByValidator,
}: ValidatorDetailsProps) {
  const [selectedPool, setSelectedPool] = React.useState<string>(
    validator?.pools.length > 0 ? '0' : 'all',
  )
  const [addPoolValidator, setAddPoolValidator] = React.useState<Validator | null>(null)
  const [addStakeValidator, setAddStakeValidator] = React.useState<Validator | null>(null)
  const [unstakeValidator, setUnstakeValidator] = React.useState<Validator | null>(null)

  const { activeAddress } = useWallet()

  const isManager = validator.config.manager === activeAddress
  const isOwner = validator.config.owner === activeAddress
  const canEdit = isManager || isOwner
  const stakingDisabled = isStakingDisabled(activeAddress, validator, constraints)
  const unstakingDisabled = isUnstakingDisabled(activeAddress, validator, stakesByValidator)

  const { stakersChartData, poolsInfo, isLoading, errorMessage, refetchAll } = useStakersChartData({
    selectedPool,
    validatorId: validator.id,
    pauseRefetch: !!addPoolValidator, // Pause refetch when adding pool
  })

  const { data: poolAssignment } = useQuery(
    validatorNodePoolAssignmentsQueryOptions(validator.id, canEdit),
  )

  const validatorHasSlots = React.useMemo(() => {
    return poolAssignment
      ? validatorHasAvailableSlots(poolAssignment, validator.config.poolsPerNode)
      : false
  }, [poolAssignment, validator.config.poolsPerNode])

  const canAddPool = canEdit && validatorHasSlots

  // If pool has no stake, set value to 1 microalgo so it appears in the donut chart (as a 1px sliver)
  const poolData =
    validator?.pools.map((pool, index) => ({
      name: `Pool ${index + 1}`,
      value: convertFromBaseUnits(Number(pool.totalAlgoStaked || 1n), 6),
    })) || []

  const selectedPoolInfo = selectedPool === 'all' ? null : poolsInfo[Number(selectedPool)]
  const selectedPoolName = getPoolNameFromIndex(selectedPool)

  // After successfully adding a pool
  const handleAddPoolClose = React.useCallback(
    async (success?: boolean) => {
      if (success) {
        await refetchAll() // Invalidate/refetch stakers chart data
        setSelectedPool('0') // Select the first pool
      }
    },
    [refetchAll],
  )

  const handlePoolClick = (eventProps: EventProps) => {
    const selected = !eventProps ? 'all' : getPoolIndexFromName(eventProps.name, true)
    setSelectedPool(selected)
  }

  const poolsChartContainerRef = React.useRef<HTMLDivElement>(null)

  const renderStakingDetails = () => {
    if (isLoading) {
      return <Loading />
    }

    if (errorMessage) {
      return <ErrorAlert title="Failed to load staking data" message={errorMessage} />
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle as="h2" className="flex items-start justify-between gap-x-2">
            Staking Details
            {poolsInfo.length > 0 && (
              <SelectPool
                selectedPool={selectedPool}
                onValueChange={setSelectedPool}
                poolsInfo={poolsInfo}
                chartContainerRef={poolsChartContainerRef}
              />
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="mt-2.5 space-y-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div
              ref={poolsChartContainerRef}
              className="self-start py-2 flex items-center justify-center"
            >
              {poolData.filter((data) => data.value > 0.000001).length > 0 ? (
                <PoolsChart
                  data={poolData}
                  onValueChange={handlePoolClick}
                  className="w-52 h-52 sm:w-64 sm:h-64"
                />
              ) : (
                <div className="flex items-center justify-center w-52 h-52 sm:w-64 sm:h-64 rounded-tremor-default border border-tremor-border dark:border-dark-tremor-border">
                  {canAddPool && validator.pools.length === 0 ? (
                    <Button onClick={() => setAddPoolValidator(validator)}>
                      <PoolIcon className="-ml-0.5 mr-1.5 h-4 w-4" />
                      Add Pool 1
                    </Button>
                  ) : (
                    <span className="text-sm text-muted-foreground">No ALGO staked</span>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center">
              <StakingPoolInfo
                validator={validator}
                constraints={constraints}
                poolInfo={selectedPoolInfo}
                poolName={selectedPoolName}
                isOwner={isOwner}
              />
            </div>
          </div>

          {isSunsetting(validator) && <SunsetNotice validator={validator} />}

          <StakersList chartData={stakersChartData} />
        </CardContent>
        <CardFooter className="flex flex-col items-stretch gap-2 sm:flex-row sm:justify-end mt-4">
          {!isSunsetted(validator) && (
            <Button onClick={() => setAddStakeValidator(validator)} disabled={stakingDisabled}>
              Add Stake
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={() => setUnstakeValidator(validator)}
            disabled={unstakingDisabled}
          >
            Unstake
          </Button>
        </CardFooter>
      </Card>
    )
  }

  return (
    <div className="py-10 space-y-4">
      <Highlights
        validator={validator}
        constraints={constraints}
        setAddPoolValidator={setAddPoolValidator}
        canAddPool={canAddPool}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <div>
          <Details validator={validator} />
        </div>
        <div className="space-y-4 lg:col-span-2">{renderStakingDetails()}</div>
      </div>

      {canAddPool && (
        <AddPoolModal
          validator={addPoolValidator}
          setValidator={setAddPoolValidator}
          poolAssignment={poolAssignment}
          onClose={handleAddPoolClose}
        />
      )}
      <AddStakeModal
        validator={addStakeValidator}
        setValidator={setAddStakeValidator}
        stakesByValidator={stakesByValidator}
        constraints={constraints}
      />
      <UnstakeModal
        validator={unstakeValidator}
        setValidator={setUnstakeValidator}
        stakesByValidator={stakesByValidator}
      />
    </div>
  )
}
