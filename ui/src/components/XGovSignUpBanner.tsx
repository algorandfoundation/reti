import { Validator } from '@/interfaces/validator'
import { Button } from './ui/button'
import { useTransactionState } from '@/hooks/useTransactionState'
import { getApplicationAddress } from 'algosdk'
import { requestSubscribeXGov } from '@/api/contracts'
import { useRegistry } from '@/hooks/useRegistry'
import { useRequestBoxes } from '@/hooks/useRequestBoxes'
import { useXGovs } from '@/hooks/useXGovs'
import { Loading } from './Loading'
import { ArrowUpRight, CheckIcon } from 'lucide-react'
import { useWallet } from '@txnlab/use-wallet-react'
import { AlgoDisplayAmount } from './AlgoDisplayAmount'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'

export type XGovSignUpBannerProps = {
  validator: Validator
}

export function XGovSignUpBanner({ validator }: XGovSignUpBannerProps) {
  const { activeAddress, transactionSigner: innerSigner, activeWallet } = useWallet()
  const registry = useRegistry()
  const pools = validator.pools.map((p) => getApplicationAddress(p.poolAppId).toString())
  const requests = useRequestBoxes(activeAddress, pools)
  const xgovs = useXGovs(pools)

  const { status, setStatus, errorMessage, isPending } = useTransactionState()

  const toastIdRef = useRef(`toast-${Date.now()}-${Math.random()}`)
  const TOAST_ID = toastIdRef.current
  const toastId = `${TOAST_ID}-request-xgov`

  useEffect(() => {
    switch (status) {
      case 'idle':
        break
      case 'loading':
      case 'signing': {
        toast.loading('Sign transactions to add stake...', { id: toastId })
        break
      }
      case 'sending': {
        toast.loading('Sending transactions...', { id: toastId })
        break
      }
      case 'confirmed': {
        toast.success(
          <div className="flex items-center gap-x-2">
            <ArrowUpRight className="h-5 w-5 text-foreground" />
            <span>Request Sent!</span>
          </div>,
          {
            id: toastId,
            duration: 5000,
          },
        )
        break
      }
      default: {
        toast.error('Failed to request xGov subscription', { id: toastId })
      }
    }
  }, [status])

  if (
    validator.config.owner !== activeAddress ||
    activeAddress === null ||
    registry.isLoading ||
    requests.isLoading ||
    xgovs.isLoading
  ) {
    return <></>
  }

  const numPools = pools.length
  const numRequested = requests.data ? Object.keys(requests.data).length : 0
  const numEnrolled = xgovs.data ? Object.keys(xgovs.data).length : 0
  const numEnrollable = numPools - (numRequested + numEnrolled)
  const requestedPools = Object.keys(requests.data ?? {}).map(
    (key) => requests.data![Number(key)].xgovAddr,
  )
  const unenrolledPools = pools.filter((p) => !xgovs.data?.[p] && !requestedPools.includes(p))

  let enrollMessage = (
    <>
      Enroll {numEnrollable} Pool{numEnrollable > 1 ? 's' : ''}
    </>
  )
  if (status === 'loading' || status === 'signing' || status === 'sending') {
    enrollMessage = (
      <>
        <Loading size="sm" className="opacity-50" />
        {status === 'signing'
          ? `Sign in ${activeWallet?.id}`
          : status === 'sending'
            ? 'Sending'
            : null}
      </>
    )
  } else if (status === 'confirmed') {
    enrollMessage = (
      <>
        <CheckIcon className="mr-2 h-4 w-4" />
        Request Sent!
      </>
    )
  } else if (errorMessage) {
    enrollMessage = <span className="text-red-500">{errorMessage}</span>
  } else if (numEnrollable < 1) {
    enrollMessage = <>All pools enrolled</>
  }

  return (
    <div className="md:mt-6 md:rounded-xl mx-auto max-w-3xl w-full bg-algo-blue dark:bg-algo-teal">
      <div className="flex flex-col md:flex-row gap-4 justify-between md:items-start p-4">
        <div>
          <h2 className="text-lg mb-1 text-center md:text-left font-semibold text-white dark:text-algo-black">
            xGov Pool Manager Sign Up
          </h2>
          <p className="text-sm mb-1 text-center md:text-left text-gray-200 dark:text-gray-600">
            Participate in xGov on behalf of your pool{numPools > 1 ? 's' : ''}!
          </p>
          <p className="text-center text-sm text-white dark:text-algo-black">
            Cost is
            <AlgoDisplayAmount
              amount={registry.data?.xgovFee ?? 0n}
              microalgos
              className="ml-2 text-white dark:text-algo-black font-mono"
            />{' '}
            per pool
          </p>
        </div>
        <div className="flex flex-col items-center">
          <h2 className="text-sm mb-4 font-semibold text-white dark:text-algo-black">
            {`${numRequested} requested | ${numEnrolled} enrolled | ${numPools} pools`}
          </h2>
          <Button
            className="bg-white dark:bg-algo-black hover:bg-algo-blue dark:hover:bg-algo-teal hover:text-white dark:hover:text-algo-black text-algo-black dark:text-white border border-algo-blue dark:border-algo-teal hover:border-white dark:hover:border-algo-black"
            onClick={() =>
              requestSubscribeXGov({
                activeAddress,
                innerSigner,
                setStatus,
                refetch: [registry.refetch, requests.refetch],
                xgovFee: registry.data?.xgovFee,
                pools: unenrolledPools,
              })
            }
            disabled={isPending || numEnrollable < 1}
          >
            {enrollMessage}
          </Button>
        </div>
      </div>
    </div>
  )
}
