import algosdk from 'algosdk'
import { Nfd } from '@/interfaces/nfd'
import { ToStringTypes } from '@/interfaces/utils'
import {
  NodePoolAssignmentConfig,
  ValidatorConfig,
  ValidatorCurState,
  ValidatorPoolKey,
} from '@/contracts/ValidatorRegistryClient'

export type EntryGatingAssets = [bigint, bigint, bigint, bigint]
// export type EntryGatingAssets = bigint[]

export type ValidatorConfigInput = Omit<
  ToStringTypes<ValidatorConfig>,
  'id' | 'sunsettingOn' | 'sunsettingTo'
>

export interface LocalPoolInfo {
  poolId: bigint
  poolAppId: bigint
  totalStakers: number
  totalAlgoStaked: bigint
  poolAddress?: string
  apy?: number
}

/**
 * The four pieces of validator state that all live in the single `v` + validatorId box,
 * and can therefore be read for every validator in one paginated request.
 */
export interface ValidatorCoreData {
  id: number
  config: ValidatorConfig
  state: ValidatorCurState
  pools: LocalPoolInfo[]
  nodePoolAssignment: NodePoolAssignmentConfig
}

export interface NodeConfig {
  poolAppIds: bigint[]
}
// export type NodeConfig = [bigint, ...bigint[]]

export type NodeInfo = {
  index: number
  availableSlots: number
}

export type Validator = {
  id: number
  config: Omit<ValidatorConfig, 'id'>
  state: ValidatorCurState
  pools: LocalPoolInfo[]
  nodePoolAssignment: NodePoolAssignmentConfig
  rewardsBalance?: bigint
  roundsSinceLastPayout?: bigint
  rewardToken?: algosdk.modelsv2.Asset
  gatingAssets?: algosdk.modelsv2.Asset[]
  nfd?: Nfd
  apy?: number
  extDeposits?: number
  perf?: number
}

export interface FindPoolForStakerResponse {
  poolKey: ValidatorPoolKey
  isNewStakerToValidator: boolean
  isNewStakerToProtocol: boolean
}

// Used for calculating validator metrics
export type PoolData = {
  balance: bigint
  lastPayout?: bigint
  apy?: number
  extDeposits?: number
}

/**
 * The parts of a staking pool's on-chain global state the UI reads. Every pool is created by
 * the registry's app account, so all of these can be read for every pool in one request.
 */
export type PoolGlobalState = {
  lastPayout?: bigint
  algodVer?: string
}
