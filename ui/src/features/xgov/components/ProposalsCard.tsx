import { useEffect, useRef, useState } from 'react'
import { isProposalFinished, PROPOSAL_STATUS } from '../utils/proposal-status'
import type { Proposal, ProposalUserCategory, Vote } from '../types/proposal'
import { ProposalCard } from './ProposalCard'
import { ProposalCategoryTabs, ProposalCategoryTabsType } from './ProposalCategoryTabs'
import { ProposalCarouselNav } from './ProposalCarouselNav'
import ProposalCarousel, { ProposalCarouselControls } from './ProposalCarousel'
import { TransactionState } from '@/api/transactionState'

export type ProposalsCardProps = {
  proposals: Proposal[]
  votes: Map<bigint, Vote> | Map<bigint, boolean> | undefined
  hasVoted: (p: Proposal) => boolean
  isVoteOpen: (p: Proposal) => boolean
  onVote: (
    vote: Vote,
    proposal: Proposal,
    setStatus: React.Dispatch<React.SetStateAction<TransactionState>>,
  ) => Promise<void>
  isOwner?: boolean
  viewOnly?: boolean
}

export function ProposalsCard({
  proposals,
  votes,
  hasVoted,
  isVoteOpen,
  onVote,
  isOwner = false,
  viewOnly = false,
}: ProposalsCardProps) {
  const [index, setIndex] = useState<number>(0)
  const controlsRef = useRef<ProposalCarouselControls | null>(null)

  const votingOpen = proposals
    .filter((p) => p.status === PROPOSAL_STATUS.VOTING && isVoteOpen(p))
    .sort((a, b) => {
      const aTime = a.voteClose?.getTime() ?? Infinity
      const bTime = b.voteClose?.getTime() ?? Infinity
      return aTime - bTime
    })
  const votingOpenNotVoted = votingOpen.filter((p) => !hasVoted(p))
  const votingOther = proposals.filter((p) => p.status === PROPOSAL_STATUS.VOTING && !isVoteOpen(p))
  const draft = proposals
    .filter((p) => p.status === PROPOSAL_STATUS.DRAFT || p.status === PROPOSAL_STATUS.SUBMITTED)
    .reverse()
  const finished = proposals.filter((p) => isProposalFinished(p)).reverse()

  const tabs: ProposalCategoryTabsType = {
    voting: {
      label: 'Voting',
      data: [...votingOpen, ...votingOther],
      displayNum: votingOpenNotVoted.length > 0 ? votingOpenNotVoted.length : undefined,
    },
    draft: { label: 'Draft', data: draft },
    finished: { label: 'Finished', data: finished },
  }

  // Set tab default to 'voting' if there are any voting proposals, otherwise to 'draft' or `finished` if there are no `draft`
  const [activeTab, setActiveTab] = useState<ProposalUserCategory>(() => {
    return tabs.voting.data.length > 0
      ? 'voting'
      : tabs.draft.data.length > 0
        ? 'draft'
        : 'finished'
  })

  const currentList = tabs[activeTab].data
  const total = currentList.length
  const currentIndex = Math.min(index, Math.max(total - 1, 0))

  const go = (dir: 1 | -1) => {
    const ctl = controlsRef.current
    if (!ctl) return
    if (dir === 1) ctl.scrollNext()
    else ctl.scrollPrev()
  }

  useEffect(() => {
    // Reset index to start when tab changes
    setIndex(0)
  }, [activeTab])

  return (
    <div className="w-full">
      <div className="flex flex-row items-center @xl:items-start justify-between mb-1 gap-1 w-full">
        <div className="flex flex-row items-center gap-2">
          <div className="flex h-7 @xl:h-8 items-center text-sm font-semibold">Proposals:</div>
          <ProposalCarouselNav currentIndex={currentIndex} total={total} go={go} />
        </div>
        <ProposalCategoryTabs tabs={tabs} activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>
      {total === 0 ? (
        <div className="flex flex-col justify-center text-center opacity-80 min-h-[265px] @xl:min-h-[144px] text-sm @xl:text-base">
          There are no {tabs[activeTab].label} proposals.
        </div>
      ) : (
        <ProposalCarousel
          items={currentList}
          index={currentIndex}
          onIndexChange={setIndex}
          onReady={(controls) => {
            controlsRef.current = controls
          }}
          renderItem={(p) => (
            <ProposalCard
              proposal={p}
              onVote={onVote}
              category={activeTab}
              vote={votes?.get(p.id) ?? false}
              isOwner={isOwner}
              viewOnly={viewOnly}
            />
          )}
        />
      )}
    </div>
  )
}
