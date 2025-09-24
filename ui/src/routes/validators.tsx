import { Loading } from '@/components/Loading'
import { Meta } from '@/components/Meta'
import { PageHeader } from '@/components/PageHeader'
import { PageMain } from '@/components/PageMain'
import { ValidatorTable } from '@/components/ValidatorTable'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { useWallet } from '@txnlab/use-wallet-react'
import {
  constraintsQueryOptions,
  numValidatorsQueryOptions,
  stakesQueryOptions,
} from '@/api/queries'
import { useValidators } from '@/hooks/useValidators'
import React from 'react'

export const Route = createFileRoute('/validators')({
  beforeLoad: ({ context: { queryClient } }) => {
    // Prefetch number of validators
    return queryClient.prefetchQuery(numValidatorsQueryOptions)
  },
  component: Validators,
  pendingComponent: () => <Loading size="lg" className="opacity-50" flex />,
  errorComponent: ({ error }) => {
    if (error instanceof Error) {
      return <div>{error?.message}</div>
    }
    return <div>Error loading validator data</div>
  },
})

function Validators() {
  const { activeAddress } = useWallet()

  const constraintsQuery = useSuspenseQuery(constraintsQueryOptions)
  const constraints = constraintsQuery.data

  // Get total number of validators
  const numValidatorsQuery = useSuspenseQuery(numValidatorsQueryOptions)
  const numValidators = numValidatorsQuery.data
  const validatorIds = React.useMemo(() => {
    return Array.from({ length: numValidators }, (_, i) => i + 1)
  }, [numValidators])

  const {
    validators,
    isLoading: validatorsLoading,
    error: validatorsError,
  } = useValidators(validatorIds)

  const stakesQuery = useQuery(stakesQueryOptions(activeAddress))
  const stakesByValidator = stakesQuery.data || []

  if (validatorsError) {
    return <div>Error loading validators: {validatorsError.message}</div>
  }

  return (
    <>
      <Meta title="Dashboard" />
      <PageHeader
        title="Browse Validators"
        description="Browse all validators and stake with any of them."
        separator
      />
      <PageMain>
        <ValidatorTable
          validators={validators}
          stakesByValidator={stakesByValidator}
          constraints={constraints}
          isLoading={validatorsLoading}
        />
      </PageMain>
    </>
  )
}
