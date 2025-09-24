import { wrapTransactionSigner } from '@/hooks/useTransactionState'
import { sleep } from '@/utils/time'
import { encodeUint64 } from 'algosdk'
import { algorandClient } from '@/api/clients'
import {
  GlobalKeysState,
  XGovBoxValue,
  XGovSubscribeRequestBoxValue,
  // @ts-expect-error module resolution issue
} from '@algorandfoundation/xgov-clients/registry'
import {
  decodeApplicationToBaseProposal,
  getProposalCategoryParams,
  getProposalVoterBox,
} from './proposal'
import { Proposal, Vote } from '@/features/xgov/types/proposal'
import { TransactionHandlerProps } from '@/api/transactionState'
import { getSimulateXGovRegistryClient, getXGovRegistryClient } from './clients'
import { PPM_MAX } from '@/constants/units'
import { AlgoAmount } from '@algorandfoundation/algokit-utils/types/amount'

export function requestBoxName(id: number): Uint8Array {
  return new Uint8Array(Buffer.concat([Buffer.from('r'), encodeUint64(id)]))
}

export async function getXGovGlobalState(): Promise<GlobalKeysState | undefined> {
  try {
    const client = await getSimulateXGovRegistryClient()
    return (await client.state.global.getAll()) as unknown as GlobalKeysState
  } catch (e) {
    console.error('failed to fetch global registry contract state', e)
    return {} as GlobalKeysState
  }
}

export async function getXGovBox(address: string): Promise<XGovBoxValue | null> {
  try {
    const client = await getSimulateXGovRegistryClient()
    const xGovBox = await client.state.box.xgovBox.value(address)

    return xGovBox
  } catch (error) {
    if (error instanceof Error && /status 404.*box not found/i.test(error.message ?? '')) {
      return null
    }

    console.error(error)
    return null
  }
}

export async function getXGovRequestBoxes(
  ownerAddress: string | null,
  xgovAddresses: string[],
): Promise<{ [id: number]: XGovSubscribeRequestBoxValue } | null> {
  try {
    const client = await getSimulateXGovRegistryClient()
    const requests = await client.state.box.requestBox.getMap()

    const requestBoxes: { [id: number]: XGovSubscribeRequestBoxValue } = {}
    for (const [key, value] of requests) {
      if (
        value.ownerAddr === ownerAddress &&
        xgovAddresses.includes(value.xgovAddr) &&
        value.relationType === 1n // Reti enum value for relation type
      ) {
        requestBoxes[Number(key)] = value
      }
    }

    return requestBoxes
  } catch (e) {
    console.error('failed to fetch request box by address', e)
    return null
  }
}

export interface RequestSubscribeXGovProps extends TransactionHandlerProps {
  xgovFee?: bigint
  pools: string[]
}

export async function requestSubscribeXGov({
  activeAddress,
  innerSigner,
  setStatus,
  refetch,
  xgovFee,
  pools,
}: RequestSubscribeXGovProps) {
  if (!innerSigner) return

  const signer = wrapTransactionSigner(innerSigner, setStatus)

  if (!activeAddress || !signer) {
    setStatus(new Error('No active address or transaction signer'))
    return
  }

  if (!xgovFee) {
    setStatus(new Error('xgovFee is not set'))
    return
  }

  const client = await getXGovRegistryClient(signer, activeAddress)

  const builder = client.newGroup()

  for (const pool of pools) {
    const payment = await client.algorand.createTransaction.payment({
      sender: activeAddress,
      receiver: client.appAddress,
      amount: xgovFee.microAlgo(),
      note: `payment for enrolling ${pool} in xGov`,
    })

    builder.requestSubscribeXgov({
      args: {
        xgovAddress: pool,
        ownerAddress: activeAddress,
        relationType: 1,
        payment,
      },
    })
  }

  try {
    const {
      confirmations: [confirmation],
    } = await builder.send({ populateAppCallResources: true })

    if (
      confirmation.confirmedRound !== undefined &&
      confirmation.confirmedRound > 0 &&
      confirmation.poolError === ''
    ) {
      setStatus('confirmed')
      await sleep(800)
      setStatus('idle')
      await Promise.all(refetch.map((r) => r()))
      return
    }

    setStatus(new Error('Failed to confirm transaction submission'))
  } catch (e) {
    console.error('Error during requestSubscribeXGov:', (e as Error).message)
    const err = new Error(`Failed to request subscription to xGov`)
    setStatus(err)
    throw err
  }
}

export async function fetchProposals(): Promise<Proposal[]> {
  try {
    const client = await getSimulateXGovRegistryClient()
    const registryState = await getXGovGlobalState()
    const result = await algorandClient.client.algod.accountInformation(client.appAddress).do()
    const proposalsRaw = result.createdApps
    const proposals: Proposal[] = []

    if (proposalsRaw) {
      proposalsRaw.forEach((proposalRaw) => {
        const proposal = decodeApplicationToBaseProposal(proposalRaw)
        if (!proposal) return
        const proposalCategoryParams = getProposalCategoryParams(
          proposal.fundingCategory,
          registryState,
        )
        proposal.voteClose = new Date(
          proposal.voteStart.getTime() + proposalCategoryParams.durationTS * 1000,
        )

        proposals.push(proposal)
      })
    }

    return proposals
  } catch (error) {
    console.error(error)
    throw error
  }
}

export interface VoteOwnerXGovProps extends TransactionHandlerProps {
  proposalId: bigint
  poolAddresses: string[]
  vote: Vote
}

export async function voteXGov({
  activeAddress,
  innerSigner,
  setStatus,
  refetch,
  proposalId,
  poolAddresses,
  vote,
}: VoteOwnerXGovProps) {
  if (!innerSigner) return

  const signer = wrapTransactionSigner(innerSigner, setStatus)

  if (!activeAddress || !signer) {
    setStatus(new Error('No active address or transaction signer'))
    return
  }

  const client = await getXGovRegistryClient(signer, activeAddress)

  const builder = client.newGroup()
  let txnCnt = 0

  for (const poolAddress of poolAddresses) {
    const voterBox = await getProposalVoterBox(proposalId, poolAddress)
    if (voterBox === null) {
      console.error(
        'Pool voter box not found. It might not be eligible to vote if it produced 0 blocks.',
      )
      continue
    }
    if (voterBox.voted) {
      console.error('Pool already voted')
      continue
    }
    const approvalVotes = (vote.approvals * voterBox.votes) / PPM_MAX
    const rejectionVotes = (vote.rejections * voterBox.votes) / PPM_MAX
    // Note: Any remainder accounts for null votes.
    // E.g. if 50% of pool votes to approve and 50% to reject and there are 3 votes for the pool,
    // the votes will be 1:1:1.
    // Pool owner does not break the tie. It only votes with the portion of stake that did not
    // cast any vote (which is already included here in `vote`).

    builder.voteProposal({
      args: {
        proposalId,
        xgovAddress: poolAddress,
        approvalVotes,
        rejectionVotes,
      },
      staticFee: AlgoAmount.MicroAlgos(2000),
    })
    txnCnt += 1
  }

  if (txnCnt === 0) {
    const err = new Error('No votes to cast. Your validator might have not produced any blocks.')
    setStatus(err)
    throw err
  }

  try {
    const {
      confirmations: [confirmation],
    } = await builder.send({ populateAppCallResources: true })

    if (
      confirmation.confirmedRound !== undefined &&
      confirmation.confirmedRound > 0 &&
      confirmation.poolError === ''
    ) {
      setStatus('confirmed')
      await sleep(800)
      setStatus('idle')
      await Promise.all(refetch.map((r) => r()))
      return
    }

    setStatus(new Error('Failed to confirm transaction submission'))
  } catch (e) {
    console.error('Error during voteOwnerXGov:', (e as Error).message)
    const err = new Error(`Failed to cast vote in xGov`)
    setStatus(err)
    throw err
  }
}
