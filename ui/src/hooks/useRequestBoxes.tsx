import { getXGovRequestBoxes } from '@/api/xgovRegistry'
import { useQuery } from '@tanstack/react-query'

export function useRequestBoxes(ownerAddress: string | null, xgovAddresses: string[]) {
  return useQuery({
    queryKey: ['getXGovRequestBoxes', ownerAddress, JSON.stringify([...xgovAddresses].sort())],
    queryFn: () => getXGovRequestBoxes(ownerAddress!, xgovAddresses!),
    enabled: !!ownerAddress && xgovAddresses.length > 0,
  })
}
