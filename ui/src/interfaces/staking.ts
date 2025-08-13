import { StakedInfo, ValidatorPoolKey } from '@/contracts/StakingPoolClient'

export interface StakerPoolData extends StakedInfo {
  poolKey: ValidatorPoolKey
  lastPayout: bigint
}

export interface StakerValidatorData {
  validatorId: bigint
  balance: bigint
  totalRewarded: bigint
  rewardTokenBalance: bigint
  entryRound: bigint
  lastPayout: bigint
  pools: Array<StakerPoolData>
}

export interface StakerChartData {
  name: string
  value: number
  href: string
}
