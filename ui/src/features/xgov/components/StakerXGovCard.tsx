import { useEffect, useMemo, useState } from 'react'
import { useWallet } from '@txnlab/use-wallet-react'
import { Loading } from '@/components/Loading'
import { useProposals } from '../hooks/useProposals'
import type { Proposal, Vote } from '../types/proposal'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { voteStakerXGov } from '../api/vote'
import { useStakerVote } from '../hooks/useVotes'
import { isVoteOpen } from '../utils/proposal-utils'
import { ProposalsCard } from './ProposalsCard'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronDown, InfoIcon } from 'lucide-react'
import { PROPOSAL_STATUS } from '../utils/proposal-status'
import { StakerValidatorData } from '@/interfaces/staking'
import { useXGovs } from '../hooks/useXGovs'
import { getApplicationAddress } from 'algosdk'
import { Tooltip } from '@/components/Tooltip'
import { TransactionState } from '@/api/transactionState'

export type StakerXGovCardProps = {
  stakesByValidator: StakerValidatorData[]
}

export function StakerXGovCard({ stakesByValidator }: StakerXGovCardProps) {
  const { activeAddress, transactionSigner: innerSigner } = useWallet()
  const proposals = useProposals()
  const votes = useStakerVote(proposals.data ?? [], activeAddress ?? '')
  const [open, setOpen] = useState(false)
  const pools = useMemo(
    () =>
      stakesByValidator.flatMap((validator) =>
        validator.pools.map((pool) => getApplicationAddress(pool.poolKey.poolAppId).toString()),
      ),
    [stakesByValidator],
  )
  const notStaking = stakesByValidator.length === 0
  const xgovs = useXGovs(pools)
  const noneInXGov = xgovs.data.size === 0 && !!activeAddress

  const isLoading = proposals.isLoading || votes.isLoading || xgovs.isLoading
  const noData =
    !proposals.data ||
    (!votes.data && !!activeAddress && proposals.data.length > 0) ||
    (!xgovs.data && stakesByValidator.length > 0)

  const hasVoted = (p: Proposal): boolean => {
    return votes.data?.has(p.id) ?? false
  }

  const onVote = async (
    vote: Vote,
    proposal: Proposal,
    setStatus: React.Dispatch<React.SetStateAction<TransactionState>>,
  ) => {
    await voteStakerXGov({
      activeAddress,
      innerSigner,
      setStatus,
      refetch: [votes.refetch],
      proposalAppId: proposal.id,
      vote,
    })
  }

  const summary = useMemo(() => {
    if (isLoading)
      return (
        <div className="flex flex-row items-center -ml-4">
          <Loading size="sm" inline className="mr-2 opacity-50" />
          <span>Loading…</span>
        </div>
      )
    if (noData) return 'Error loading'
    if (noneInXGov && !notStaking) return 'None of your validators participate in xGov!'
    if (notStaking && activeAddress) return 'Stake with an xGov validator to participate!'
    const total = proposals.data!.length
    const toVote = proposals.data!.filter(
      (p) => p.status === PROPOSAL_STATUS.VOTING && !hasVoted(p) && isVoteOpen(p),
    ).length
    const voted = proposals.data!.filter((p) => hasVoted(p)).length
    return `${toVote} open •${!activeAddress ? `` : ` ${voted} voted •`} ${total} total`
  }, [isLoading, noData, proposals.data, noneInXGov, hasVoted])

  // Open xGov if user has stake
  useEffect(() => {
    setOpen(!noneInXGov && !!activeAddress)
  }, [noneInXGov, activeAddress])

  return (
    <Card className="@container mx-auto w-full bg-algo-blue text-white dark:bg-algo-teal dark:text-algo-black">
      <CardHeader className={`p-3 @xl:p-6 pb-2 ${!open ? '@xl:pb-6' : '@xl:pb-2'}`}>
        <div className="flex flex-col">
          <div className="flex items-center justify-between">
            <div className="flex flex-col mr-2">
              <CardTitle as="h2">Algorand xGov</CardTitle>
              <div className="flex flex-row gap-1 items-center">
                <CardDescription className="text-gray-300 dark:text-gray-600">
                  <span className="text-sm hidden @xl:block">
                    Vote on proposals to shape the future of Algorand!
                  </span>
                  <span className="text-sm block @xl:hidden">
                    Vote on proposals that shape Algorand!
                  </span>
                </CardDescription>
                <Tooltip
                  content={`By staking in pools, you are delegating your xGov participation to your validators. If you cast your vote in due time, you instruct them to vote with your pools' shares according to your wishes.`}
                  className="max-w-xs whitespace-normal break-words"
                >
                  <InfoIcon className="h-4 w-4 text-gray-300 dark:text-gray-600" />
                </Tooltip>
              </div>
            </div>
            <div className="justify-end @xl:text-sm @2xl:text-base opacity-80 mr-4 hidden @xl:flex flex-row flex-1 h-full">
              {summary}
            </div>
            <Collapsible open={open} onOpenChange={setOpen} className="shrink-0">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="data-[state=open]:rotate-180">
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </CollapsibleTrigger>
            </Collapsible>
          </div>
          <div className="flex justify-center mt-1 text-sm opacity-80 @xl:hidden">{summary}</div>
        </div>
      </CardHeader>

      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleContent asChild>
          <CardContent className="p-3 @xl:p-6 pt-0 @xl:pt-0">
            <div className="flex flex-col items-center bg-white/10 dark:bg-black/10 rounded-lg p-2">
              {isLoading ? (
                <div className="flex flex-row items-center -ml-4">
                  <Loading size="md" flex className="opacity-50" />
                  <span>Loading xGov data</span>
                </div>
              ) : noData ? (
                <div className="flex flex-row items-center -ml-4">
                  <Loading size="md" flex className="opacity-50 hidden" />
                  <span className="text-red-600">Error! Could not get xGov data</span>
                </div>
              ) : (
                <ProposalsCard
                  proposals={proposals.data}
                  votes={votes.data}
                  hasVoted={hasVoted}
                  isVoteOpen={isVoteOpen}
                  onVote={onVote}
                  isOwner={false}
                  viewOnly={noneInXGov || notStaking}
                />
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}
