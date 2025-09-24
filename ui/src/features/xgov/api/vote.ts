import { getIndexerConfigFromViteEnvironment } from '@/utils/network/getAlgoClientConfigs'
import { algorandClient } from '@/api/clients'
import { ClientManager } from '@algorandfoundation/algokit-utils/types/client-manager'
import { getApplicationAddress } from 'algosdk'
import { Proposal, Vote } from '@/features/xgov/types/proposal'
import { fetchValidatorRewards } from '@/features/rewards/api/rewards'
import { TransactionHandlerProps } from '@/api/transactionState'
import { Validator } from '@/interfaces/validator'
import { voteXGov } from './registry'
import { wrapTransactionSigner } from '@/hooks/useTransactionState'
import { sleep } from '@/utils/time'
import { getProposalVoterBox } from './proposal'
import { PPM_MAX } from '@/constants/units'
import { getXGovRegistryAppIdFromViteEnvironment } from '@/utils/env'
import { getXGovCommitteeRoundMultiple, getXGovCommitteeRoundWindow } from '../utils/getXGovConfig'

const indexerConfig = getIndexerConfigFromViteEnvironment()
const indexer = ClientManager.getIndexerClient({
  server: indexerConfig?.server ?? '',
  port: indexerConfig?.port ?? '',
  token: indexerConfig?.token ?? '',
})

const XGOV_REGISTRY_APP_ID = BigInt(getXGovRegistryAppIdFromViteEnvironment())
const xGovVoteOpinionAddress = getApplicationAddress(XGOV_REGISTRY_APP_ID).toString()
const notePrefix = 'xGovReti'

export interface VoteStakerXGovProps extends TransactionHandlerProps {
  proposalAppId: bigint
  vote: Vote
}
/**
 * Staker casts a vote for (i.e. expresses an opinion on) a proposal.
 * Vote is cast as 0 payment transaction to xGovVoteOpinionAddress with note field of format:
 * xgov/<app ID>:j{"a":<i>,"r":<j>,"n":<k>}
 * where: i,j,k are integers representing portion of approvals, rejections, and nulls, expressed in ppm.
 */
export async function voteStakerXGov({
  activeAddress,
  innerSigner,
  setStatus,
  refetch,
  proposalAppId,
  vote,
}: VoteStakerXGovProps) {
  if (!innerSigner) return
  const signer = wrapTransactionSigner(innerSigner, setStatus)

  if (!activeAddress || !signer) {
    setStatus(new Error('No active address or transaction signer'))
    return
  }

  const noteString = `${notePrefix}/${proposalAppId.toString()}:j{"a":${vote.approvals.toString()},"r":${vote.rejections.toString()},"n":${vote.nulls.toString()}}`
  const note = new TextEncoder().encode(noteString)

  try {
    const {
      confirmations: [confirmation],
    } = await algorandClient.send.payment({
      sender: activeAddress,
      receiver: xGovVoteOpinionAddress,
      amount: (0).algo(),
      note: note,
      signer: signer,
    })

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
    console.error('Error during voteStakerXGov:', (e as Error).message)
    const err = new Error(`Failed to cast vote in xGov`)
    setStatus(err)
    throw err
  }
}

function parseTxnNote(note: string): { id: bigint; vote: Vote } | null {
  const escapedPrefix = notePrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`^${escapedPrefix}/([^:]+):j(.+)$`)
  const m = re.exec(note)
  if (!m) return null

  const [_, appIdStr, jsonPart] = m

  let obj: unknown
  try {
    obj = JSON.parse(jsonPart)
  } catch {
    return null
  }

  if (!(typeof obj === 'object' && obj !== null && 'a' in obj && 'r' in obj && 'n' in obj))
    return null

  const { a, r, n } = obj

  const toBigInt = (v: unknown): bigint | null => {
    if (typeof v === 'bigint') return v
    if (typeof v === 'number' && Number.isInteger(v)) return BigInt(v)
    if (typeof v === 'string' && /^-?\d+$/.test(v)) return BigInt(v)
    return null
  }

  const approvals = toBigInt(a)
  const rejections = toBigInt(r)
  const nulls = toBigInt(n)
  if (approvals === null || rejections === null || nulls === null) return null
  if (approvals + rejections + nulls !== PPM_MAX) return null

  return { id: BigInt(appIdStr), vote: { approvals, rejections, nulls } }
}

export async function fetchProposalStakersVotes(
  proposal: Proposal,
  stakers: string[],
): Promise<Map<string, Vote>> {
  try {
    const votes = new Map<string, Vote>()
    const notePrefixUint8Array = new TextEncoder().encode(
      `${notePrefix}/${proposal.id.toString()}:`,
    )

    // Get all past pay txn to the xGovVoteOpinionAddress in proposal time window, with correct note prefix
    let nextToken: string | undefined = undefined
    const txns = []
    do {
      let req = await indexer
        .searchForTransactions()
        .txType('pay')
        .address(xGovVoteOpinionAddress)
        .addressRole('receiver')
        .notePrefix(notePrefixUint8Array)
        .afterTime(proposal.voteStart)
      if (proposal.voteClose) req = req.beforeTime(proposal.voteClose)
      if (nextToken) req = req.nextToken(nextToken)
      const response = await req.do()
      // Keep txns just from stakers
      txns.push(...response.transactions.filter((txn) => stakers.includes(txn.sender)))
      nextToken = response.nextToken
    } while (nextToken)

    // Sort txns from newest to oldest
    txns.sort((a, b) => Number(b.confirmedRound! - a.confirmedRound!))

    // Process each txn
    for (const txn of txns) {
      const staker = txn.sender
      const vote = votes.get(staker)
      if (!vote) {
        const note = txn.note
        if (!note) continue
        const noteParsed = parseTxnNote(new TextDecoder().decode(note))
        if (!noteParsed) continue
        if (proposal.id !== noteParsed.id) continue
        votes.set(staker, noteParsed.vote)
      }
    }

    return votes
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function fetchStakerVotes(
  proposals: Proposal[],
  staker: string,
): Promise<Map<bigint, Vote>> {
  try {
    const votes = new Map<bigint, Vote>()
    const minVoteStart = new Date(Math.min(...proposals.map((p) => p.voteStart.getTime())))
    const voteCloseTimes = proposals
      .map((p) => p.voteClose?.getTime())
      .filter((t): t is number => t !== undefined)
    const maxVoteClose =
      voteCloseTimes.length > 0 ? new Date(Math.max(...voteCloseTimes)) : undefined

    const notePrefixUint8Array = new TextEncoder().encode(`${notePrefix}/`)

    // Get all past pay txn from staker in max proposals' time window, with correct base note prefix
    let nextToken: string | undefined = undefined
    const txns = []
    do {
      let req = await indexer
        .searchForTransactions()
        .txType('pay')
        .address(staker)
        .addressRole('sender')
        .notePrefix(notePrefixUint8Array)
        .afterTime(minVoteStart)
      if (maxVoteClose) req = req.beforeTime(maxVoteClose)
      if (nextToken) req = req.nextToken(nextToken)
      const response = await req.do()
      // Keep txns just to xGovVoteOpinionAddress
      txns.push(
        ...response.transactions.filter(
          (txn) => txn.paymentTransaction?.receiver === xGovVoteOpinionAddress,
        ),
      )
      nextToken = response.nextToken
    } while (nextToken)

    // Sort txns from newest to oldest
    txns.sort((a, b) => Number(b.confirmedRound! - a.confirmedRound!))

    // Process every txn
    for (const txn of txns) {
      const note = txn.note
      if (!note) continue
      const noteParsed = parseTxnNote(new TextDecoder().decode(note))
      if (!noteParsed) continue
      if (votes.get(noteParsed.id)) continue
      votes.set(noteParsed.id, noteParsed.vote)
    }

    return votes
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function fetchPoolsVotes(
  proposal: Proposal,
  poolAddresses: string[],
): Promise<{
  votedTrue: string[]
  votedFalse: string[]
  votedUnknown: string[]
} | null> {
  try {
    const results = await Promise.all(
      poolAddresses.map(async (poolAddress) => {
        const voterBox = await getProposalVoterBox(proposal.id, poolAddress)
        return { poolAddress, voterBox }
      }),
    )

    const votedTrue: string[] = []
    const votedFalse: string[] = []
    const votedUnknown: string[] = []

    for (const { poolAddress, voterBox } of results) {
      if (!voterBox) {
        votedUnknown.push(poolAddress)
      } else if (voterBox.voted) {
        votedTrue.push(poolAddress)
      } else {
        votedFalse.push(poolAddress)
      }
    }

    return { votedTrue, votedFalse, votedUnknown }
  } catch (error) {
    console.error(error)
    throw error
  }
}

export function createEmptyVote(): Vote {
  return {
    approvals: 0n,
    rejections: 0n,
    nulls: 0n,
  } as Vote
}

export function addVote(s: Vote, v: Vote, w?: bigint) {
  const _w = w === undefined ? 1n : w
  s.approvals += v.approvals * _w
  s.rejections += v.rejections * _w
  s.nulls += v.nulls * _w
}

export function calcVote(
  stakersRewards: Map<string, bigint>,
  votesStakers: Map<string, Vote>,
  votePoolOwner: Vote,
): Vote {
  // Combine stakerVotes and poolOwnerVotes to joint vote percentages, across all pools
  const vote = createEmptyVote()
  const rewardsTotal = Array.from(stakersRewards.values()).reduce((s, v) => s + v, 0n)
  let rewardsUnused = 0n
  for (const [staker, reward] of stakersRewards) {
    const voteStaker = votesStakers.get(staker)
    if (!voteStaker) {
      rewardsUnused += reward
    } else {
      addVote(vote, voteStaker, reward)
    }
  }
  // Add poolOwner vote for unused rewards
  addVote(vote, votePoolOwner, rewardsUnused)
  // Normalize from rewards to ppm
  if (rewardsTotal === 0n) return createEmptyVote()
  vote.approvals /= rewardsTotal
  vote.rejections /= rewardsTotal
  vote.nulls /= rewardsTotal
  // The sum of `vote` fields at this point might not be PPM_MAX due to rounding (i.e. for ties).
  // These are counted as `nulls`.
  vote.nulls += PPM_MAX - (vote.approvals + vote.rejections + vote.nulls)

  return vote
}

const XGOV_COMMITEE_ROUND_MULTIPLE = getXGovCommitteeRoundMultiple()

export function calcCommitteeRoundEnd(roundCreated: bigint): bigint {
  return (roundCreated / XGOV_COMMITEE_ROUND_MULTIPLE) * XGOV_COMMITEE_ROUND_MULTIPLE
}

export interface VoteOwnerXGovProps extends TransactionHandlerProps {
  validator: Validator
  proposal: Proposal
  votePoolOwner: Vote
}

export async function voteOwnerXGov({
  activeAddress,
  innerSigner,
  setStatus,
  refetch,
  validator,
  proposal,
  votePoolOwner,
}: VoteOwnerXGovProps) {
  try {
    // TO DO: For better precision, add API call to get rounds of the committee. ARC-0086 is too ambiguous.
    // Here we use approximation that end committee round is the nearest millionth round to the proposal smart contract
    // creation time, rounded down.
    const appInfo = await indexer.lookupApplications(proposal.id).do()
    if (!appInfo.application?.createdAtRound) {
      const err = new Error(`Failed to get proposal committee's evaluation window`)
      console.error(err)
      setStatus(err)
      throw err
    }
    const roundTo = calcCommitteeRoundEnd(appInfo.application.createdAtRound)
    const roundFrom = roundTo - getXGovCommitteeRoundWindow()

    const stakersRewards = await fetchValidatorRewards(validator, roundTo, roundFrom)
    const votesStakers = await fetchProposalStakersVotes(
      proposal,
      Array.from(stakersRewards?.keys() ?? []),
    )
    const vote = calcVote(stakersRewards, votesStakers, votePoolOwner)

    const poolAddresses = validator.pools.map((p) => getApplicationAddress(p.poolAppId).toString())
    await voteXGov({
      activeAddress,
      innerSigner,
      setStatus,
      refetch,
      proposalId: proposal.id,
      poolAddresses,
      vote,
    })
  } catch (error) {
    console.error(error)
    if (error instanceof Error) setStatus(error)
    throw error
  }
}
