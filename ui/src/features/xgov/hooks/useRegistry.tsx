import { getXGovGlobalState } from '@/features/xgov/api/registry'
import { useQuery } from '@tanstack/react-query'

export function useRegistry() {
  return useQuery({
    queryKey: ['getXGovGlobalState'],
    queryFn: getXGovGlobalState,
  })
}
