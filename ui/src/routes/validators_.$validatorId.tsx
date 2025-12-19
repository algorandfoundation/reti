import { ValidatorNotFoundError } from '@/api/contracts'
import {
  constraintsQueryOptions,
  stakesQueryOptions,
  validatorSingleQueryOptions,
} from '@/api/queries'
import { Loading } from '@/components/Loading'
import { Meta } from '@/components/Meta'
import { PageMain } from '@/components/PageMain'
import { ValidatorDetails } from '@/components/ValidatorDetails'
import { DetailsHeader } from '@/components/ValidatorDetails/DetailsHeader'
import { XGovSignUpBanner } from '@/components/XGovSignUpBanner'
import { useValidator } from '@/hooks/useValidator'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, ErrorComponent } from '@tanstack/react-router'
import { useWallet } from '@txnlab/use-wallet-react'

export const Route = createFileRoute('/validators_/$validatorId')({
  beforeLoad: () => {
    return {
      queryOptions: {
        data: validatorSingleQueryOptions,
      },
    }
  },
  loader: async ({ context: { queryClient, queryOptions }, params }) => {
    const validatorId = Number(params.validatorId)
    try {
      await Promise.all([queryClient.ensureQueryData(queryOptions.data(validatorId))])
    } catch (error) {
      throw new ValidatorNotFoundError(
        `Validator with id "${Number(validatorId)}" not found! Error: ${error}`,
      )
    }
  },
  component: Dashboard,
  pendingComponent: () => <Loading size="lg" className="opacity-50" />,
  errorComponent: ({ error }) => {
    if (error instanceof ValidatorNotFoundError) {
      return <div>{error.message}</div>
    }
    return <ErrorComponent error={error} />
  },
})

function Dashboard() {
  const { validatorId } = Route.useParams()
  const validator = useValidator(Number(validatorId))
  const { activeAddress } = useWallet()

  const constraintsQuery = useQuery(constraintsQueryOptions)
  const stakesQuery = useQuery(stakesQueryOptions(activeAddress))
  const stakesByValidator = stakesQuery.data || []

  const pageTitle = validator?.nfd ? validator.nfd.name : `Validator ${validatorId}`

  return (
    <>
      <Meta title={pageTitle} />
      <XGovSignUpBanner validator={validator!} />
      <DetailsHeader validator={validator!} />
      <PageMain>
        <ValidatorDetails
          validator={validator!}
          constraints={constraintsQuery.data!}
          stakesByValidator={stakesByValidator}
        />
      </PageMain>
    </>
  )
}
