import { NodelyRetiPerf, NodelyRetiPoolApyData } from '@/interfaces/nodely'
import axiosNodelyApi from '@/lib/axiosNodelyApi'

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
    return { apy: 0 } as NodelyRetiPoolApyData
  }
}
