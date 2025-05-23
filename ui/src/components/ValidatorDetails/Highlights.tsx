import { CirclePlus, Coins, Percent, Users } from 'lucide-react'
import { AlgoDisplayAmount } from '@/components/AlgoDisplayAmount'
import { PoolIcon } from '@/components/PoolIcon'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Constraints } from '@/contracts/ValidatorRegistryClient'
import { Validator } from '@/interfaces/validator'
import { calculateMaxStakers } from '@/utils/contracts'

interface HighlightsProps {
  validator: Validator
  constraints: Constraints
  setAddPoolValidator: (validator: Validator | null) => void
  canAddPool: boolean
}

export function Highlights({
  validator,
  constraints,
  setAddPoolValidator,
  canAddPool,
}: HighlightsProps) {
  const totalStakers = validator.state.totalStakers
  const maxStakers = calculateMaxStakers(validator, constraints)
  const { poolsPerNode } = validator.config
  const maxNodes = Number(constraints.maxNodes)

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle as="h2" className="text-sm font-medium">
              Total Staked
            </CardTitle>
            <Coins className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold lg:text-xl xl:text-2xl">
              <AlgoDisplayAmount
                amount={validator.state.totalAlgoStaked}
                microalgos
                maxLength={13}
                compactPrecision={2}
                mutedRemainder
              />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle as="h2" className="text-sm font-medium">
              Stakers
            </CardTitle>
            <Users className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold lg:text-xl xl:text-2xl">
              {totalStakers.toString()}{' '}
              <span className="text-muted-foreground">/ {maxStakers.toString()}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle as="h2" className="text-sm font-medium">
              Pools
            </CardTitle>
            <PoolIcon className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-x-2 text-2xl font-bold lg:text-xl xl:text-2xl">
              {validator.state.numPools.toString()}{' '}
              <span className="text-muted-foreground">
                / {(poolsPerNode * maxNodes).toString()}
              </span>
              {canAddPool && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="group -my-2"
                  onClick={() => setAddPoolValidator(validator)}
                >
                  <CirclePlus className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-foreground" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle as="h2" className="text-sm font-medium">
              Commission
            </CardTitle>
            <Percent className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold lg:text-xl xl:text-2xl">
              {`${Number(validator.config.percentToValidator) / 10000}%`}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
