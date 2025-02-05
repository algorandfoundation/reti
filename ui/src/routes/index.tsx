import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
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

export const Route = createFileRoute('/')({
  beforeLoad: ({ context: { queryClient } }) => {
    // Prefetch number of validators
    return queryClient.prefetchQuery(numValidatorsQueryOptions)
  },
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

  const { validators, isLoading: validatorsLoading, error: validatorsError } = useValidators()

  const stakesQuery = useQuery(stakesQueryOptions(activeAddress))
  const stakesByValidator = stakesQuery.data || []

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
            isLoading={validatorsLoading || stakesQuery.isLoading}
          />
          <ValidatorTable
            validators={validators}
            stakesByValidator={stakesByValidator}
            constraints={constraints}
            isLoading={validatorsLoading}
          />
        </div>
      </PageMain>
    </>
  )
}
