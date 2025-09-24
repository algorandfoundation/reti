import { Button } from '@/components/ui/button'
import { useTransactionState } from '@/hooks/useTransactionState'
import { Loading } from '@/components/Loading'
import { ArrowUpRight, CheckIcon } from 'lucide-react'
import { useWallet } from '@txnlab/use-wallet-react'
import { AlgoDisplayAmount } from '@/components/AlgoDisplayAmount'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { cn } from '@/utils/ui'
import { TransactionState } from '@/api/transactionState'
import {
  GlobalKeysState as RegistryGlobalKeyState,
  XGovBoxValue,
  XGovSubscribeRequestBoxValue,
  // @ts-expect-error module resolution issue
} from '@algorandfoundation/xgov-clients/registry'

export type XGovSignUpBannerProps = {
  pools: string[]
  registry: RegistryGlobalKeyState
  xgovs: Map<string, XGovBoxValue>
  requests: {
    [id: number]: XGovSubscribeRequestBoxValue
  }
  subscribeXGov: (
    setStatus: React.Dispatch<React.SetStateAction<TransactionState>>,
  ) => Promise<void>
  className?: string
}

export function XGovSignUpBanner({
  pools,
  registry,
  xgovs,
  requests,
  subscribeXGov,
  className,
}: XGovSignUpBannerProps) {
  const { activeWallet } = useWallet()
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
        toast.loading('Sign transactions to enroll in xGov...', { id: toastId })
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

  const numPools = pools.length
  const numRequested = Object.keys(requests).length
  const numEnrolled = xgovs.size
  const numEnrollable = numPools - (numRequested + numEnrolled)

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
  } else if (numPools <= 0) {
    enrollMessage = <>There are no pools</>
  } else if (numPools - numEnrolled < 1) {
    enrollMessage = <>All pools enrolled</>
  } else if (numEnrollable < 1) {
    enrollMessage = <>All pools enrolled or pending</>
  }

  return (
    <div className={cn('flex flex-col gap-2 md:items-center justify-center', className)}>
      <div>
        <h3 className="text-md mb-1 text-center font-semibold text-white dark:text-algo-black">
          Enroll each pool in xGov to be eligible to vote!
        </h3>
        <p className="text-center text-xs sm:text-sm text-gray-200 dark:text-gray-600">
          Cost is
          <AlgoDisplayAmount
            amount={registry.xgovFee ?? 0n}
            microalgos
            className="ml-2 text-white dark:text-algo-black font-mono"
          />{' '}
          per pool
        </p>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Button
          className="bg-white dark:bg-algo-black hover:bg-algo-blue dark:hover:bg-algo-teal hover:text-white dark:hover:text-algo-black text-algo-black dark:text-white border border-algo-blue dark:border-algo-teal hover:border-white dark:hover:border-algo-black"
          onClick={() => subscribeXGov(setStatus)}
          disabled={isPending || numEnrollable < 1}
        >
          {enrollMessage}
        </Button>
        <h3 className="text-xs sm:text-sm font-semibold text-white dark:text-algo-black">
          {`${numEnrolled} enrolled | ${numRequested} pending | ${numPools} pools`}
        </h3>
      </div>
    </div>
  )
}
