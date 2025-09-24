import { useQueries, useQuery } from '@tanstack/react-query'
import { fetchStakerVotes, fetchPoolsVotes } from '../api/vote'
import { Proposal, Vote } from '../types/proposal'
import { Validator } from '@/interfaces/validator'
import { ALGORAND_ZERO_ADDRESS_STRING, getApplicationAddress, isValidAddress } from 'algosdk'

export function useOwnerVote(proposals: Proposal[], validator: Validator) {
  return useQueries({
    queries: proposals.map((proposal) => ({
      queryKey: ['voteOwner', validator.config.owner, proposal.id.toString()],
      queryFn: async (): Promise<boolean> => {
        const poolAddresses = validator.pools.map((p) =>
          getApplicationAddress(p.poolAppId).toString(),
        )
        if (poolAddresses.length === 0) return false
        const poolAddressesVotes = await fetchPoolsVotes(proposal, poolAddresses)
        return (
          poolAddressesVotes !== null &&
          poolAddressesVotes.votedTrue.length === poolAddresses.length
        )
      },
    })),
    combine: (results) => {
      const data = new Map<bigint, true>()
      results.forEach((r, i) => {
        const id = proposals[i]?.id
        if (r.data) data.set(id, true)
      })
      return {
        data,
        isLoading: results.some((r) => r.isLoading),
        isPending: results.some((r) => r.isPending),
        isFetching: results.some((r) => r.isFetching),
        isError: results.some((r) => r.isError),
        refetchFns: results.map((r) => r.refetch),
        queries: results,
      }
    },
  })
}

export function useStakerVote(proposals: Proposal[], address: string) {
  const proposalIds = proposals.map((p) => p.id.toString())

  return useQuery<Map<bigint, Vote>>({
    queryKey: ['votesStaker', address, proposalIds],
    queryFn: async () => await fetchStakerVotes(proposals, address),
    enabled:
      !!address &&
      isValidAddress(address) &&
      address !== ALGORAND_ZERO_ADDRESS_STRING &&
      proposals.length > 0,
  })
}
