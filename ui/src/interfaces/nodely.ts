// export interface Meta {
//   name: string
//   type: 'UInt64' | 'Int64' | 'String' | 'Float64'
// }

/**
 * One row per staking pool. The `UInt64`/`Int64` columns arrive as bare JSON numbers, not
 * quoted strings - see the endpoint's own `meta` block.
 */
export interface NodelyRetiPerfData {
  validatorid: number
  poolid: number
  poolappid: number
  poolappaddr: string
  rspan: number
  rounds: number
  avgfp: number
  votes: number
  expSoftVotes: number
  perf: number
  fOnline: number
  lastSVRnd: number
}

export interface NodelyRetiPerf {
  // meta: Meta[]
  data: NodelyRetiPerfData[]
}

export interface NodelyRetiPoolApyData {
  pool_addr: string
  total_interest: number
  total_block_fees: number
  total_external_deposits: number
  weighted_balance: number
  live_seconds: number
  live_years: number
  simple_rate: number
  apy: number
}
