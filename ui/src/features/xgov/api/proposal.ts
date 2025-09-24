import {
  GlobalKeysState as ProposalGlobalKeysState,
  VoterBox,
  // @ts-expect-error module resolution issue
} from '@algorandfoundation/xgov-clients/proposal'
import {
  GlobalKeysState as XGovRegistryGlobalKeysState,
  // @ts-expect-error module resolution issue
} from '@algorandfoundation/xgov-clients/registry'
import { Proposal, ProposalCategoryParams, Vote } from '@/features/xgov/types/proposal'
import { AppManager } from '@algorandfoundation/algokit-utils/types/app-manager'
import { Application } from 'algosdk/dist/types/client/v2/algod/models/types'
import { FUNDING_CATEGORY, FundingCategory } from '../utils/funding-category'
import { ProposalStatus } from '../utils/proposal-status'
import { getSimulateProposalClient } from './clients'
import { ALGORAND_ZERO_ADDRESS_STRING } from '@/constants/accounts'
import algosdk from 'algosdk'

export async function getProposalGlobalState(
  proposalAppId: bigint,
): Promise<ProposalGlobalKeysState | undefined> {
  try {
    const client = await getSimulateProposalClient(proposalAppId)
    return (await client.state.global.getAll()) as unknown as ProposalGlobalKeysState
  } catch (e) {
    console.error('failed to fetch proposal contract global state', e)
    return {} as ProposalGlobalKeysState
  }
}

export async function getProposalVoterBox(
  proposalAppId: bigint,
  xgovAddress: string,
): Promise<VoterBox | null> {
  try {
    const client = await getSimulateProposalClient(proposalAppId)
    const voterBox = await client.state.box.voters.value(xgovAddress)

    return voterBox
  } catch (error) {
    if (error instanceof Error && /status 404.*box not found/i.test(error.message ?? '')) {
      return null
    }

    console.error(error)
    return null
  }
}

export function getProposalCategoryParams(
  fundingCategory: FundingCategory,
  registryState: XGovRegistryGlobalKeysState,
): ProposalCategoryParams {
  switch (fundingCategory) {
    case FUNDING_CATEGORY.NULL:
      return { durationTS: 0 }
    case FUNDING_CATEGORY.SMALL:
      return { durationTS: Number(registryState.votingDurationSmall) }
    case FUNDING_CATEGORY.MEDIUM:
      return { durationTS: Number(registryState.votingDurationMedium) }
    case FUNDING_CATEGORY.LARGE:
      return { durationTS: Number(registryState.votingDurationLarge) }
  }
}

/**
 * Creates a base proposal object from the proposal data
 */
export function createBaseProposal({
  id,
  proposer,
  requestedAmount,
  status,
  fundingCategory,
  title,
  votesXGov,
  voteStart,
}: {
  id: bigint
  proposer: string
  requestedAmount: bigint
  status: ProposalStatus
  fundingCategory: FundingCategory
  title: string
  votesXGov: Vote
  voteStart: Date
}): Proposal {
  return {
    id,
    proposer,
    requestedAmount,
    status,
    fundingCategory,
    title,
    votesXGov,
    voteStart,
  }
}

// Decode app global state from application object and create a proposal object
export function decodeApplicationToBaseProposal(app: Application): Proposal | undefined {
  const appId = BigInt(app.id)
  const globalAppState = app.params?.globalState
  if (!globalAppState) return

  const gsRaw = AppManager.decodeAppState(globalAppState)
  const proposerRaw = gsRaw.proposer
  let proposer = ALGORAND_ZERO_ADDRESS_STRING
  if ('valueRaw' in proposerRaw) proposer = algosdk.encodeAddress(proposerRaw.valueRaw)
  const title = String(gsRaw.title.value)

  const proposal = createBaseProposal({
    id: appId,
    proposer: proposer,
    requestedAmount: BigInt(gsRaw.requested_amount.value),
    status: BigInt(gsRaw.status.value) as ProposalStatus,
    fundingCategory: BigInt(gsRaw.funding_category.value) as FundingCategory,
    title: title,
    votesXGov: {
      approvals: BigInt(gsRaw.approvals.value),
      rejections: BigInt(gsRaw.rejections.value),
      nulls: BigInt(gsRaw.nulls.value),
    },
    voteStart: new Date(Number(gsRaw.vote_opening_timestamp.value) * 1000),
  })

  return proposal
}
