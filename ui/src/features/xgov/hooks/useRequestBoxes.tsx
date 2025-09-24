import { getXGovRequestBoxes } from '@/features/xgov/api/registry'
import { useQuery } from '@tanstack/react-query'

export function useRequestBoxes(ownerAddress: string | null, xgovAddresses: string[]) {
  return useQuery({
    queryKey: ['getXGovRequestBoxes', ownerAddress, JSON.stringify([...xgovAddresses].sort())],
    queryFn: async () => {
      if (xgovAddresses.length === 0) return {}
      return await getXGovRequestBoxes(ownerAddress, xgovAddresses)
    },
    enabled: !!ownerAddress,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchInterval: 1000 * 60 * 60 * 2, // 2 hours
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })
}
