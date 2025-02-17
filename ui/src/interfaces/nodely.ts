// export interface Meta {
//   name: string
//   type: 'UInt64' | 'Int64' | 'String' | 'Float64'
// }

export interface NodelyRetiPerfData {
  validatorid: string
  poolid: string
  poolappid: string
  poolappaddr: string
  rspan: string
  rounds: string
  avgfp: number
  votes: string
  expSoftVotes: number
  perf: number
  fOnline: number
  lastSVRnd: string
}

export interface NodelyRetiPerf {
  // meta: Meta[]
  data: NodelyRetiPerfData[]
}

export interface NodelyRetiPoolApyData {
  pool_addr: string
  total_interest: number
  total_block_fees: number
  weighted_balance: number
  live_seconds: number
  live_years: number
  simple_rate: number
  apy: number
}
