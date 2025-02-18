import axiosRetry from 'axios-retry'
import axiosNodelyApi from '@/lib/axiosNodelyApi'
import { NodelyRetiPerf, NodelyRetiPoolApyData } from '@/interfaces/nodely'
import { AxiosError } from 'axios'

// Configure axios-retry for the axiosNodelyApi instance
axiosRetry(axiosNodelyApi, {
  retries: 6,
  retryDelay: (retryCount: number, _: AxiosError) => {
    // Exponential backoff: delay in ms
    return axiosRetry.exponentialDelay(retryCount)
  },
  retryCondition: (error: AxiosError) => {
    // Retry only if the response status is 429 or a network error occurs
    return axiosRetry.isRetryableError(error) || error?.response?.status === 429
  },
})

export async function fetchNodely24hPerf(): Promise<NodelyRetiPerf> {
  const { data: perfData } = await axiosNodelyApi.get<NodelyRetiPerf>(
    '/v1/delayed/reti/poolvotingperformance/24hr',
    { params: { format: 'JSON' } },
  )
  return perfData
}

export async function fetchNodelyVotingPerf(address: string): Promise<NodelyRetiPoolApyData> {
  try {
    const { data: apyData } = await axiosNodelyApi.get<NodelyRetiPoolApyData>(
      `/v1/realtime/reti/pool/${address}/apy`,
      { params: { format: 'JSON' } },
    )
    return apyData
  } catch (error) {
    // Log the error (optional)
    console.error('Error fetching Nodely APR Data:', error)

    // Return a default fallback value
    return { apy: 0 } as NodelyRetiPoolApyData
  }
}
