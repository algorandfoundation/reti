import { fetchProposals } from '@/features/xgov/api/registry'
import { useQuery } from '@tanstack/react-query'

export function useProposals() {
  return useQuery({
    queryKey: ['proposals'],
    queryFn: fetchProposals,
    refetchInterval: 1000 * 60 * 1, // 1 minutes
    refetchOnWindowFocus: true,
    refetchOnMount: false,
  })
}
