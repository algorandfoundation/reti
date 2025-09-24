import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useWallet } from '@txnlab/use-wallet-react'
import {
  constraintsQueryOptions,
  numValidatorsQueryOptions,
  stakesQueryOptions,
} from '@/api/queries'
import { Loading } from '@/components/Loading'
import { Meta } from '@/components/Meta'
import { PageHeader } from '@/components/PageHeader'
import { PageMain } from '@/components/PageMain'
import { StakingTable } from '@/components/StakingTable'
import { ValidatorTable } from '@/components/ValidatorTable'
import { useValidators } from '@/hooks/useValidators'
import { useMemo } from 'react'
import {
  getFeaturedValidatorIds,
  getRndValidatorNum,
} from '@/utils/network/getFeaturedValidatorIds'
import { getRandomUniqueIntegers } from '@/utils/random'

export const Route = createFileRoute('/')({
  component: Dashboard,
  pendingComponent: () => <Loading size="lg" className="opacity-50" flex />,
  errorComponent: ({ error }) => {
    if (error instanceof Error) {
      return <div>{error?.message}</div>
    }
    return <div>Error loading validator data</div>
  },
})

function Dashboard() {
  const { activeAddress } = useWallet()

  const constraintsQuery = useSuspenseQuery(constraintsQueryOptions)
  const constraints = constraintsQuery.data

  const stakesQuery = useQuery(stakesQueryOptions(activeAddress))
  const stakesByValidator = stakesQuery.data || []
  const stakerValidatorIds = useMemo(
    () => stakesByValidator.map((s) => Number(s.validatorId)),
    [stakesByValidator],
  )

  // Get featured validator IDs
  const featuredValidatorsIds = useMemo(() => getFeaturedValidatorIds(), [])
  // Get total number of validators
  const numValidatorsQuery = useSuspenseQuery(numValidatorsQueryOptions)
  const numValidators = numValidatorsQuery.data
  // Randomly select validators to be featured
  const rndValidatorIds = useMemo(() => {
    if (numValidators <= 0) return []
    const numRndIds = getRndValidatorNum()
    if (numRndIds > numValidators) return Array.from({ length: numValidators }, (_, i) => i + 1)
    const rndIds = getRandomUniqueIntegers(numRndIds, numValidators)
    return rndIds
  }, [numValidators])

  // Get all featured validator IDs
  const allFeaturedValidatorIds = useMemo(
    () => [...new Set([...featuredValidatorsIds, ...rndValidatorIds])],
    [featuredValidatorsIds, rndValidatorIds],
  )

  // Get all validator IDs to fetch
  const allValidatorIdsSet = useMemo(
    () => new Set([...stakerValidatorIds, ...allFeaturedValidatorIds]),
    [stakerValidatorIds, allFeaturedValidatorIds],
  )
  const allValidatorIds = useMemo(() => [...allValidatorIdsSet], [allValidatorIdsSet])

  // Fetch all validators
  const {
    validators,
    isLoading: validatorsLoading,
    error: validatorsError,
  } = useValidators(allValidatorIds)

  const isValidatorsLoading = validatorsLoading || numValidatorsQuery.isLoading

  // Get just featured validators
  const featuredValidators = validators.filter((v) => allValidatorIdsSet.has(v.id))

  if (validatorsError) {
    return <div>Error loading validators: {validatorsError.message}</div>
  }

  return (
    <>
      <Meta title="Dashboard" />
      <PageHeader
        title="Staking Dashboard"
        description="Browse validators in the protocol and manage your staking activity."
        separator
      />
      <PageMain>
        <div className="space-y-8">
          <StakingTable
            validators={validators}
            stakesByValidator={stakesByValidator}
            constraints={constraints}
            isLoading={isValidatorsLoading || stakesQuery.isLoading}
          />
          <ValidatorTable
            validators={featuredValidators}
            stakesByValidator={stakesByValidator}
            constraints={constraints}
            isLoading={isValidatorsLoading}
            title={'Featured Validators'}
          />
          <div className="flex flex-row w-full justify-center">
            <Link to="/validators" className="link">
              Browse All Validators
            </Link>
          </div>
        </div>
      </PageMain>
    </>
  )
}
