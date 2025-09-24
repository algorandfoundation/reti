import { ProposalStatus } from '../utils/proposal-status'
import { FundingCategory } from '../utils/funding-category'

export type Proposal = {
  id: bigint
  proposer: string
  requestedAmount: bigint
  status: ProposalStatus
  fundingCategory: FundingCategory
  title: string
  votesXGov: Vote
  voteStart: Date
  voteClose?: Date
}

export type Vote = {
  approvals: bigint
  rejections: bigint
  nulls: bigint
}

export type ProposalCategoryParams = {
  durationTS: number
}

export type ProposalUserCategory = 'voting' | 'draft' | 'finished'

export type UserVoteChoice = 'for' | 'against' | 'abstain'
