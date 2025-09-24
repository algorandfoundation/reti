import { getXGovGlobalState } from '@/features/xgov/api/registry'
import { useQuery } from '@tanstack/react-query'

export function useRegistry() {
  return useQuery({
    queryKey: ['getXGovGlobalState'],
    queryFn: getXGovGlobalState,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })
}
