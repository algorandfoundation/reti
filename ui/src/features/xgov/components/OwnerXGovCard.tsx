import { useEffect, useMemo, useState } from 'react'
import { useWallet } from '@txnlab/use-wallet-react'
import { Loading } from '@/components/Loading'
import { useProposals } from '../hooks/useProposals'
import type { Validator } from '@/interfaces/validator'
import type { Proposal, Vote } from '../types/proposal'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { useOwnerVote } from '../hooks/useVotes'
import { isVoteOpen } from '../utils/proposal-utils'
import { XGovSignUpBanner } from './XGovSignUpBanner'
import { getApplicationAddress } from 'algosdk'
import { useRequestBoxes } from '../hooks/useRequestBoxes'
import { useXGovs } from '../hooks/useXGovs'
import { ProposalsCard } from './ProposalsCard'
import { Tooltip } from '@/components/Tooltip'
import { InfoIcon } from 'lucide-react'
import { voteOwnerXGov } from '../api/vote'
import { TransactionState } from '@/api/transactionState'
import { useRegistry } from '../hooks/useRegistry'
import { requestSubscribeXGov } from '../api/registry'

export type OwnerXGovCardProps = {
  validator: Validator
}

type XGovView = 'vote' | 'enroll'

export function OwnerXGovCard({ validator }: OwnerXGovCardProps) {
  const { activeAddress, transactionSigner: innerSigner } = useWallet()
  const registry = useRegistry()
  const proposals = useProposals()
  const votes = useOwnerVote(proposals.data ?? [], validator)

  const pools = useMemo(
    () => validator.pools.map((p) => getApplicationAddress(p.poolAppId).toString()),
    [validator.pools],
  )
  const requests = useRequestBoxes(activeAddress, pools)
  const xgovs = useXGovs(pools)
  const numPools = pools.length
  const numRequested = requests.data ? Object.keys(requests.data).length : 0
  const numEnrolled = xgovs.data.size
  const numEnrollable = numPools - (numRequested + numEnrolled)
  const requestedPools = Object.keys(requests.data ?? {}).map(
    (key) => requests.data![Number(key)].xgovAddr,
  )
  const unenrolledPools = pools.filter((p) => !xgovs.data.get(p) && !requestedPools.includes(p))

  const isOwner = validator.config.owner === activeAddress
  const isLoading =
    proposals.isLoading ||
    votes.isLoading ||
    requests.isLoading ||
    xgovs.isLoading ||
    registry.isLoading
  const noData = !proposals.data || !votes.data || !requests.data || !registry.data || !xgovs.data

  const [view, setView] = useState<XGovView>('enroll')

  // Set tab default to 'vote' if no pool needs to be enrolled - after data has loaded
  useEffect(() => {
    if (!requests.isLoading && !xgovs.isLoading)
      setView(() => {
        return numEnrollable < 1 && numPools > 0 ? 'vote' : 'enroll'
      })
  }, [requests.isLoading, xgovs.isLoading, numEnrollable])

  const hasVoted = (p: Proposal): boolean => {
    return votes.data?.has(p.id) ?? false
  }

  const onVote = async (
    vote: Vote,
    proposal: Proposal,
    setStatus: React.Dispatch<React.SetStateAction<TransactionState>>,
  ) => {
    await voteOwnerXGov({
      activeAddress,
      innerSigner,
      setStatus,
      refetch: [...votes.refetchFns, proposals.refetch],
      validator,
      proposal,
      votePoolOwner: vote,
    })
  }

  const subscribeXGov = async (setStatus: React.Dispatch<React.SetStateAction<TransactionState>>) =>
    requestSubscribeXGov({
      activeAddress,
      innerSigner,
      setStatus,
      refetch: [registry.refetch, requests.refetch],
      xgovFee: registry.data?.xgovFee,
      pools: unenrolledPools,
    })

  return (
    <Card className="@container mx-auto w-full bg-algo-blue text-white dark:bg-algo-teal dark:text-algo-black">
      <CardHeader className="p-3 @xl:p-6 pb-0 @xl:pb-0">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle as="h2">xGov Management</CardTitle>
            <div className="flex flex-row gap-1 items-center">
              <CardDescription className="text-gray-300 dark:text-gray-600">
                <span className="text-sm hidden @xl:block">
                  Participate in xGov on behalf of your stakers!
                </span>
                <span className="text-sm block @xl:hidden">Participate on behalf of stakers</span>
              </CardDescription>
              <Tooltip
                content={`Your stakers have the right to express their opinion. When you cast your validator's vote, stakers' preferences will be aggregated. If a staker has not expressed its opinion, its voting power is delegated to you. Your voting window is reduced to allow stakers to share their preferences.`}
                className="max-w-xs whitespace-normal break-words"
              >
                <InfoIcon className="h-4 w-4 text-gray-300 dark:text-gray-600" />
              </Tooltip>
            </div>
          </div>
          {!isLoading && !noData && (
            <div className="inline-flex rounded-lg bg-white/10 dark:bg-black/10 p-0.5">
              {(['vote', 'enroll'] as const).map((val) => (
                <button
                  key={val}
                  onClick={() => setView(val)}
                  className={`px-2 h-8 text-sm rounded-md transition ${
                    view === val
                      ? 'bg-white text-algo-blue dark:bg-algo-black dark:text-white'
                      : 'opacity-80 hover:opacity-100'
                  }`}
                >
                  {val === 'vote' ? 'Vote' : 'Enroll'}
                </button>
              ))}
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-3 @xl:p-6 pt-2 @xl:pt-2">
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
          ) : view === 'vote' ? (
            <ProposalsCard
              proposals={proposals.data}
              votes={votes.data}
              hasVoted={hasVoted}
              isVoteOpen={(p: Proposal) => isVoteOpen(p, true)}
              onVote={onVote}
              isOwner={isOwner}
              viewOnly={numPools === 0}
            />
          ) : (
            <XGovSignUpBanner
              pools={pools}
              registry={registry.data}
              xgovs={xgovs.data}
              requests={requests.data!}
              subscribeXGov={subscribeXGov}
              className="min-h-[184px]"
            />
          )}
        </div>
      </CardContent>
    </Card>
  )
}
