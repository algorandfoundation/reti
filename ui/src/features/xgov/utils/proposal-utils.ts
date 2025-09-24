import { Proposal, UserVoteChoice, Vote } from '../types/proposal'
import { getXGovCloseWindowTS } from './getXGovConfig'

const voteCloseWindowTS = getXGovCloseWindowTS()

export const voteOpens = (p: Proposal, isOwner: boolean = false) => {
  return isOwner
    ? p.voteClose
      ? new Date(p.voteClose.getTime() - voteCloseWindowTS * 1000)
      : null
    : p.voteStart
}

export const voteCloses = (p: Proposal, isOwner: boolean = false) => {
  return isOwner
    ? (p.voteClose ?? null)
    : !p.voteClose
      ? null
      : new Date(p.voteClose.getTime() - voteCloseWindowTS * 1000)
}

export const isVoteOpen = (p: Proposal, isOwner: boolean = false) => {
  const now = new Date()
  const voteOpen = voteOpens(p, isOwner)
  const voteClose = voteCloses(p, isOwner)
  return !!voteOpen && !!voteClose && now > voteOpen && now < voteClose
}

export function getVoteMajorResult(vote: Vote): UserVoteChoice {
  const { approvals, rejections, nulls } = vote

  if (approvals >= rejections && approvals >= nulls) {
    return 'for'
  }
  if (rejections >= approvals && rejections >= nulls) {
    return 'against'
  }
  return 'abstain'
}
