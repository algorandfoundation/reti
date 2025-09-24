import { Link as LinkIcon } from 'lucide-react'
import type { Proposal, ProposalUserCategory, Vote } from '../types/proposal'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { ellipseAddressJsx } from '@/utils/ellipseAddress'
import { ExplorerLink } from '@/utils/explorer'
import { formatDate } from '../utils/formatting'
import { AlgoDisplayAmount } from '@/components/AlgoDisplayAmount'
import { proposalStatusLabel } from '../utils/proposal-status'
import { ProposalVoteForm } from './ProposalVoteForm'
import { useQuery } from '@tanstack/react-query'
import { nfdLookupQueryOptions } from '@/api/queries'
import { getNfdAppFromViteEnvironment } from '@/utils/network/getNfdConfig'
import { getVoteMajorResult, isVoteOpen, voteCloses, voteOpens } from '../utils/proposal-utils'
import { getXGovUrlFromViteEnvironment } from '../utils/getXGovConfig'
import { TransactionState } from '@/api/transactionState'

const nfdAppUrl = getNfdAppFromViteEnvironment()
const xGovPlatformUrl = getXGovUrlFromViteEnvironment()

export type ProposalCardProps = {
  proposal: Proposal
  onVote: (
    vote: Vote,
    proposal: Proposal,
    setStatus: React.Dispatch<React.SetStateAction<TransactionState>>,
  ) => Promise<void>
  category: ProposalUserCategory
  vote?: Vote | boolean
  isOwner?: boolean
  viewOnly?: boolean
}

export function ProposalCard({
  proposal,
  onVote,
  category,
  vote = false,
  isOwner = false,
  viewOnly = false,
}: ProposalCardProps) {
  const proposerNfdQuery = useQuery(
    nfdLookupQueryOptions(proposal.proposer, {
      view: 'thumbnail',
    }),
  )

  const isOpen = isVoteOpen(proposal, isOwner)

  const castVote = async (
    vote: Vote,
    setStatus: React.Dispatch<React.SetStateAction<TransactionState>>,
  ) => {
    await onVote(vote, proposal, setStatus)
  }

  const renderContent = () => {
    const voteOpen = voteOpens(proposal, isOwner)
    const voteClose = voteCloses(proposal, isOwner)

    let txtSub = ''
    let txtMain = ''
    switch (category) {
      case 'voting': {
        if (!voteOpen || !voteClose) {
          txtSub = 'Voting windows is not yet defined.'
          txtMain = ''
        } else {
          const now = new Date()
          if (now < voteOpen) {
            txtSub = 'Vote opens:'
            txtMain = formatDate(voteOpen)
          } else if (now < voteClose) {
            txtSub = 'Vote closes:'
            txtMain = formatDate(voteClose)
          } else {
            txtSub = 'Vote closed:'
            txtMain = formatDate(voteClose)
          }
        }
        break
      }
      case 'draft': {
        if (!proposal.voteStart.getTime()) {
          txtSub = 'Proposal is not yet finalized.'
          txtMain = ''
        } else {
          txtSub = 'Vote opens:'
          txtMain = voteOpen ? formatDate(voteOpen) : 'N/A'
        }
        break
      }
      case 'finished': {
        txtSub = 'Status:'
        txtMain = proposalStatusLabel(proposal.status)
      }
    }
    return (
      <div className="h-10 items-center flex flex-row gap-1 min-w-0">
        <div className="opacity-70 min-w-0 break-words">{txtSub}</div>
        <div className="min-w-0 break-words">{txtMain}</div>
      </div>
    )
  }

  const renderVote = () => {
    if (category === 'voting' && !vote) {
      return (
        <ProposalVoteForm castVote={castVote} canVote={isOpen && !viewOnly} isOwner={isOwner} />
      )
    } else {
      if (category !== 'draft' && vote) {
        if (vote === true) {
          return <div className="opacity-70">You voted on this proposal!</div>
        } else {
          const userMajorResult = getVoteMajorResult(vote)
          return (
            <div className="h-10 flex flex-row min-w-0 items-center ">
              <div className="opacity-70">You voted&nbsp;</div>
              <span className="italic font-bold opacity-100">{userMajorResult}</span>
              <div className="opacity-70">&nbsp;on this proposal.</div>
            </div>
          )
        }
      } else {
        return <div className="h-10"></div>
      }
    }
  }

  return (
    <Card className="bg-white/70 dark:bg-algo-black/70 text-algo-black dark:text-white w-full min-h-[144px]">
      <CardHeader className="pb-3">
        <CardTitle className="truncate pb-1">{proposal.title}</CardTitle>
        <div className="flex flex-col @xl:flex-row @xl:items-center gap-1 justify-between text-sm">
          <div className="flex flex-row gap-1 w-[200px] @3xl:w-[300px]">
            <div className="opacity-70">
              <span className="text-sm hidden @3xl:block">Proposal by:</span>
              <span className="text-sm block @3xl:hidden">By:</span>
            </div>
            {proposerNfdQuery.data ? (
              <a
                href={`${nfdAppUrl}/name/${proposerNfdQuery.data.name}`}
                target="_blank"
                rel="noreferrer"
                className="link block truncate max-w-[168px]"
              >
                {proposerNfdQuery.data.name}
              </a>
            ) : (
              <a
                href={`${xGovPlatformUrl}/profile/${proposal.proposer}`}
                target="_blank"
                rel="noreferrer"
                className="link block truncate max-w-[168px]"
              >
                {ellipseAddressJsx(proposal.proposer)}
              </a>
            )}
          </div>
          <div className="flex flex-row gap-1 w-[100px] @3xl:w-[200px]">
            <div className="opacity-70">
              <span className="text-sm hidden @3xl:block">Requested amount:</span>
              <span className="text-sm block @3xl:hidden">Request:</span>
            </div>
            <AlgoDisplayAmount
              amount={proposal.requestedAmount}
              microalgos
              maxLength={4}
              compactPrecision={1}
              mutedRemainder
            />
          </div>
          <div className="flex flex-row gap-1 w-[100px] @5xl:w-[180px]">
            <div className="opacity-70">
              <span className="text-sm hidden @5xl:block">Proposal ID:</span>
              <span className="text-sm block @5xl:hidden">ID:</span>
            </div>
            <a
              href={ExplorerLink.app(proposal.id)}
              target="_blank"
              rel="noreferrer"
              className="link"
            >
              {proposal.id.toString()}
            </a>
          </div>
          <span className="flex flex-row gap-1">
            <LinkIcon className="h-4 w-4" />
            <a
              href={`${xGovPlatformUrl}/proposal/${proposal.id.toString()}`}
              target="_blank"
              rel="noreferrer"
              className="link"
            >
              <span className="text-sm hidden @4xl:block">More details</span>
              <span className="text-sm block @4xl:hidden">Details</span>
            </a>
          </span>
        </div>
      </CardHeader>

      <CardContent className="text-sm flex flex-col @xl:flex-row gap-1 @xl:items-center justify-between @xl:h-[56px]">
        {renderContent()}
        {renderVote()}
      </CardContent>
    </Card>
  )
}
