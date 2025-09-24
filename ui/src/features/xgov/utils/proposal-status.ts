import { Proposal } from '../types/proposal'

export const PROPOSAL_STATUS = {
  EMPTY: 0n, // Empty structure (default values) for a new proposal
  DRAFT: 10n, // Initialized from the xGov Portal
  SUBMITTED: 20n, // Draft submitted to vote
  VOTING: 25n, // Open to vote until expiration
  APPROVED: 30n, // Approved at the end of voting
  REJECTED: 40n, // Rejected at the end of voting
  REVIEWED: 45n, // Approved proposal reviewed
  FUNDED: 50n, // Proposal has been funded
  BLOCKED: 60n, // Blocked with veto
} as const

export type ProposalStatus = (typeof PROPOSAL_STATUS)[keyof typeof PROPOSAL_STATUS]

const PROPOSAL_STATUS_VALUES = Object.values(PROPOSAL_STATUS) as readonly ProposalStatus[]

export function isProposalStatus(x: unknown): boolean {
  return typeof x === 'bigint' && PROPOSAL_STATUS_VALUES.includes(x as ProposalStatus)
}

export const PROPOSAL_STATUS_LABELS = new Map<ProposalStatus, keyof typeof PROPOSAL_STATUS>(
  Object.entries(PROPOSAL_STATUS).map(([k, v]) => [
    v as ProposalStatus,
    k as keyof typeof PROPOSAL_STATUS,
  ]),
)

export function proposalStatusLabel(status: ProposalStatus) {
  return PROPOSAL_STATUS_LABELS.get(status)!
}

export const FINISHED_STATUS_VALUES = [
  PROPOSAL_STATUS.APPROVED,
  PROPOSAL_STATUS.REJECTED,
  PROPOSAL_STATUS.REVIEWED,
  PROPOSAL_STATUS.FUNDED,
  PROPOSAL_STATUS.BLOCKED,
] as const satisfies readonly ProposalStatus[]

export const FINISHED_STATUSES = new Set<ProposalStatus>(FINISHED_STATUS_VALUES)

export function isProposalFinished(x: Proposal): boolean {
  return isProposalStatus(x.status) && FINISHED_STATUSES.has(x.status as ProposalStatus)
}
