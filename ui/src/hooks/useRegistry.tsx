import { getXGovGlobalState } from '@/api/xgovRegistry'
import { useQuery } from '@tanstack/react-query'

export function useRegistry() {
  return useQuery({
    queryKey: ['getXGovGlobalState'],
    queryFn: getXGovGlobalState,
  })
}
