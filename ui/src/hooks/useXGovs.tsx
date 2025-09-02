import { getXGovBoxes } from '@/api/xgovRegistry'
import { useQuery } from '@tanstack/react-query'

export function useXGovs(xgovAddresses: string[]) {
  return useQuery({
    queryKey: ['getXGovBoxes', xgovAddresses],
    queryFn: () => getXGovBoxes(xgovAddresses!),
    enabled: xgovAddresses.length > 0,
  })
}
