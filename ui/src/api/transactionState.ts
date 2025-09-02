import type { QueryObserverResult, RefetchOptions } from '@tanstack/react-query'
import type algosdk from 'algosdk'

export type TransactionState = 'idle' | 'loading' | 'signing' | 'sending' | 'confirmed' | Error

export type TransactionStateProps = {
  status: TransactionState
  setStatus: React.Dispatch<React.SetStateAction<TransactionState>>
  errorMessage?: string
  setErrorMessage: (err: string) => void
  reset: () => void
  isPending: boolean
}

export type TransactionStateInfo = Omit<
  TransactionStateProps,
  'setStatus' | 'setErrorMessage' | 'reset'
>

export interface TransactionHandlerProps {
  activeAddress: string | null
  innerSigner: algosdk.TransactionSigner
  setStatus: (status: TransactionState) => void
  refetch: ((options?: RefetchOptions) => Promise<QueryObserverResult<unknown, Error>>)[]
}
