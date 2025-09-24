import { getXGovBox } from '@/features/xgov/api/registry'
import { useQueries } from '@tanstack/react-query'
import { ALGORAND_ZERO_ADDRESS_STRING, isValidAddress } from 'algosdk'
import {
  XGovBoxValue,
  // @ts-expect-error module resolution issue
} from '@algorandfoundation/xgov-clients/registry'

export function useXGovs(xgovAddresses: string[]) {
  return useQueries({
    queries: xgovAddresses.map((address) => ({
      queryKey: ['xGovBox', address],
      queryFn: async () => getXGovBox(address),
      enabled: !!address && isValidAddress(address) && address !== ALGORAND_ZERO_ADDRESS_STRING,
      staleTime: Infinity,
      gcTime: Infinity,
      refetchInterval: 1000 * 60 * 60 * 1, // 1 hours
      refetchOnWindowFocus: true,
      refetchOnMount: false,
    })),
    combine: (results) => {
      const data = new Map<string, XGovBoxValue>()
      results.forEach((r, i) => {
        if (r.data) data.set(xgovAddresses[i], r.data)
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
