import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useWallet } from '@txnlab/use-wallet-react'
import {
  allValidatorsQueryOptions,
  constraintsQueryOptions,
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
    // Prefetch every validator's core data in a single request
    const options = allValidatorsQueryOptions(queryClient)
    const prefetch = queryClient.prefetchQuery(options)

    // Only a cold cache is worth blocking the route on. When the persisted cache was restored
    // the table paints from it immediately and this refresh lands underneath it.
    return queryClient.getQueryData(options.queryKey) ? undefined : prefetch
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
