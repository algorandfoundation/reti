import { Button } from '@/components/ui/button'
import { useRef, useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { UserVoteChoice, Vote } from '../types/proposal'
import { useTransactionState } from '@/hooks/useTransactionState'
import { Loading } from '@/components/Loading'
import { CheckIcon } from 'lucide-react'
import { createEmptyVote } from '../api/vote'
import { PPM_MAX } from '@/constants/units'
import { toast } from 'sonner'
import { TransactionState } from '@/api/transactionState'
import { useWallet } from '@txnlab/use-wallet-react'
import { Tooltip } from '@/components/Tooltip'

export type ProposalVoteFormProps = {
  castVote: (
    vote: Vote,
    setStatus: React.Dispatch<React.SetStateAction<TransactionState>>,
  ) => Promise<void>
  canVote: boolean
  isOwner?: boolean
}

export function ProposalVoteForm({ castVote, canVote, isOwner = false }: ProposalVoteFormProps) {
  const [selectedVote, setSelectedVote] = useState<UserVoteChoice | null>(null)
  const { activeAddress } = useWallet()
  const { status, setStatus, errorMessage, isPending } = useTransactionState()

  const toastIdRef = useRef(`toast-${Date.now()}-${Math.random()}`)
  const TOAST_ID = toastIdRef.current
  const toastId = `${TOAST_ID}-proposals`

  let voteMessage = <>Vote</>
  if (status === 'loading' || status === 'signing' || status === 'sending') {
    voteMessage = (
      <>
        <Loading size="sm" inline className="opacity-50 mr-1" />
        {status === 'signing'
          ? `Sign`
          : status === 'sending'
            ? 'Sending'
            : isOwner
              ? 'Getting stakers votes'
              : null}
      </>
    )
  } else if (status === 'confirmed') {
    voteMessage = (
      <>
        <CheckIcon className="mr-2 h-4 w-4" />
        Sent!
      </>
    )
  } else if (errorMessage) {
    voteMessage = <span className="block @xl:max-w-[100px] truncate">{errorMessage}</span>
  }

  const onSubmit = async (choice: UserVoteChoice) => {
    try {
      toast.loading('Submitting your vote…', { id: `${toastId}-vote` })

      const vote = createEmptyVote()
      switch (choice) {
        case 'for':
          vote.approvals = PPM_MAX
          break
        case 'against':
          vote.rejections = PPM_MAX
          break
        case 'abstain':
          vote.nulls = PPM_MAX
          break
      }

      setStatus('loading')
      await castVote(vote, setStatus)
      setSelectedVote(null)
      toast.success('Vote submitted!', { id: `${toastId}-vote` })
    } catch (error) {
      toast.error('Failed to submit vote', { id: `${toastId}-vote` })
      console.error(error)
    }
  }

  if (!activeAddress) return <div className="h-10">Connect wallet to vote!</div>

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={async (e) => {
        e.preventDefault()
        if (selectedVote) await onSubmit(selectedVote)
      }}
    >
      <div className={`${!canVote ? 'opacity-50' : ''}`}>Cast:</div>
      <Select
        onValueChange={(v) => {
          setStatus('idle')
          setSelectedVote((v as UserVoteChoice) ?? null)
        }}
        value={selectedVote ?? undefined}
      >
        <SelectTrigger className="w-[90px] px-2" disabled={!canVote}>
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="for">For</SelectItem>
          <SelectItem value="against">Against</SelectItem>
          <SelectItem value="abstain">Abstain</SelectItem>
        </SelectContent>
      </Select>

      {errorMessage ? (
        <Tooltip content={errorMessage} className="max-w-[200px] whitespace-normal break-words">
          <span className="inline-flex">
            <Button type="submit" className="px-3" disabled={!selectedVote || isPending}>
              {voteMessage}
            </Button>
          </span>
        </Tooltip>
      ) : (
        <Button type="submit" className="px-3" disabled={!selectedVote || isPending}>
          {voteMessage}
        </Button>
      )}
    </form>
  )
}
