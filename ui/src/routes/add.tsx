import { mbrAndProtocolConstraintsQueryOptions } from '@/api/queries'
import { AddValidatorForm } from '@/components/AddValidatorForm'
import { ErrorAlert } from '@/components/ErrorAlert'
import { Loading } from '@/components/Loading'
import { Meta } from '@/components/Meta'
import { PageHeader } from '@/components/PageHeader'
import { PageMain } from '@/components/PageMain'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Navigate, createFileRoute, redirect } from '@tanstack/react-router'
import { useWallet } from '@txnlab/use-wallet-react'

export const Route = createFileRoute('/add')({
  beforeLoad: ({ context }) => {
    if (!context.walletManager.activeAddress) {
      throw redirect({
        to: '/',
      })
    }
  },
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(mbrAndProtocolConstraintsQueryOptions),
  component: AddValidator,
  pendingComponent: () => <Loading size="lg" className="opacity-50" />,
  errorComponent: ({ error }) => {
    const defaultMessage = 'See console for error details.'
    const message =
      error instanceof Error
        ? `Error loading protocol constraints: ${error?.message || defaultMessage}`
        : defaultMessage
    return <ErrorAlert title="Error loading form" message={message} />
  },
})

function AddValidator() {
  const mbrAndConstraintsQuery = useSuspenseQuery(mbrAndProtocolConstraintsQueryOptions)
  const constraints = mbrAndConstraintsQuery.data.constraints

  const { activeAddress } = useWallet()

  if (!activeAddress) {
    return <Navigate to="/" />
  }

  return (
    <>
      <Meta title="Add Validator" />
      <PageHeader
        title="Add a Validator"
        description="Create a new validator with the specified configuration."
        separator
      />
      <PageMain>
        <AddValidatorForm constraints={constraints} />
      </PageMain>
    </>
  )
}
