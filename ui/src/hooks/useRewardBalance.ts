import { useQuery } from '@tanstack/react-query'
import { useBlockTime } from '@/hooks/useBlockTime'
import { Validator } from '@/interfaces/validator'
import { fetchRemainingRewardsBalance } from '@/utils/contracts'

export function useRewardBalance(validator: Validator) {
  const { rewardTokenId } = validator.config

  const blockTime = useBlockTime()
  const staleTime = Number(validator.config.epochRoundLength) * blockTime.ms

  return useQuery({
    queryKey: ['reward-balance', validator.id],
    queryFn: () => fetchRemainingRewardsBalance(validator),
    retry: (retryCount, error) => {
      if (error?.message.includes('Pool 1 not found')) {
        return false
      }
      return retryCount < 3
    },
    enabled: !!rewardTokenId,
    staleTime,
  })
}
