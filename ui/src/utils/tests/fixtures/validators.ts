import { ALGORAND_ZERO_ADDRESS_STRING } from '@/constants/accounts'
import { LocalPoolInfo, Validator } from '@/interfaces/validator'
import {
  ACCOUNT_1,
  ACCOUNT_2,
  ACCOUNT_3,
  ACCOUNT_4,
  ACCOUNT_5,
} from '@/utils/tests/fixtures/accounts'
import {
  Constraints,
  NodePoolAssignmentConfig,
  ValidatorConfig,
  ValidatorCurState,
} from '@/contracts/ValidatorRegistryClient'

export const MOCK_VALIDATOR_1_CONFIG: ValidatorConfig = {
  id: 1n,
  owner: ACCOUNT_1,
  manager: ACCOUNT_1,
  nfdForInfo: 0n,
  entryGatingType: 0,
  entryGatingAddress: ALGORAND_ZERO_ADDRESS_STRING,
  entryGatingAssets: [0n, 0n, 0n, 0n],
  gatingAssetMinBalance: 0n,
  rewardTokenId: 0n,
  rewardPerPayout: 0n,
  epochRoundLength: 1286,
  percentToValidator: 5,
  validatorCommissionAddress: ACCOUNT_1,
  minEntryStake: 10n,
  maxAlgoPerPool: 0n,
  poolsPerNode: 1,
  sunsettingOn: 0n,
  sunsettingTo: 0n,
}

export const MOCK_VALIDATOR_1_STATE: ValidatorCurState = {
  numPools: 2,
  totalStakers: 2n,
  totalAlgoStaked: 72000000000000n,
  rewardTokenHeldBack: 0n,
}

export const MOCK_VALIDATOR_1_POOLS: LocalPoolInfo[] = [
  {
    poolId: 1n,
    poolAppId: 1010n,
    totalStakers: 2,
    totalAlgoStaked: 70000000000000n,
    poolAddress: ACCOUNT_2,
    algodVersion: '3.23.1 rel/stable [34171a94] : v0.8.0 [d346b13]',
  },
  {
    poolId: 2n,
    poolAppId: 1011n,
    totalStakers: 2,
    totalAlgoStaked: 2000000000000n,
    poolAddress: ACCOUNT_3,
    algodVersion: '3.23.1 rel/stable [34171a94] : v0.8.0 [d346b13]',
  },
]

export const MOCK_VALIDATOR_1_POOL_ASSIGNMENT: NodePoolAssignmentConfig = {
  nodes: [
    [[70000000000000n, 0n, 0n]],
    [[2000000000000n, 0n, 0n]],
    [[0n, 0n, 0n]],
    [[0n, 0n, 0n]],
    [[0n, 0n, 0n]],
    [[0n, 0n, 0n]],
    [[0n, 0n, 0n]],
    [[0n, 0n, 0n]],
  ],
}

export const MOCK_VALIDATOR_2_CONFIG: ValidatorConfig = {
  id: 2n,
  owner: ACCOUNT_4,
  manager: ACCOUNT_4,
  nfdForInfo: 0n,
  entryGatingType: 0,
  entryGatingAddress: ALGORAND_ZERO_ADDRESS_STRING,
  entryGatingAssets: [0n, 0n, 0n, 0n],
  gatingAssetMinBalance: 0n,
  rewardTokenId: 0n,
  rewardPerPayout: 0n,
  epochRoundLength: 1286,
  percentToValidator: 5,
  validatorCommissionAddress: ACCOUNT_4,
  minEntryStake: 10n,
  maxAlgoPerPool: 0n,
  poolsPerNode: 1,
  sunsettingOn: 0n,
  sunsettingTo: 0n,
}

export const MOCK_VALIDATOR_2_STATE: ValidatorCurState = {
  numPools: 1,
  totalStakers: 1n,
  totalAlgoStaked: 1000n,
  rewardTokenHeldBack: 0n,
}

export const MOCK_VALIDATOR_2_POOLS: LocalPoolInfo[] = [
  {
    poolId: 1n,
    poolAppId: 1020n,
    totalStakers: 1,
    totalAlgoStaked: 1000n,
    poolAddress: ACCOUNT_5,
    algodVersion: '3.23.1 rel/stable [34171a94] : v0.8.0 [d346b13]',
  },
]

export const MOCK_VALIDATOR_2_POOL_ASSIGNMENT: NodePoolAssignmentConfig = {
  nodes: [
    [[1000n, 0n, 0n]],
    [[0n, 0n, 0n]],
    [[0n, 0n, 0n]],
    [[0n, 0n, 0n]],
    [[0n, 0n, 0n]],
    [[0n, 0n, 0n]],
    [[0n, 0n, 0n]],
    [[0n, 0n, 0n]],
  ],
}

const { id: validator1Id, ...validator1Config } = MOCK_VALIDATOR_1_CONFIG

export const MOCK_VALIDATOR_1: Validator = {
  id: Number(validator1Id),
  config: validator1Config,
  state: MOCK_VALIDATOR_1_STATE,
  pools: MOCK_VALIDATOR_1_POOLS,
  nodePoolAssignment: MOCK_VALIDATOR_1_POOL_ASSIGNMENT,
}

const { id: validator2Id, ...validator2Config } = MOCK_VALIDATOR_2_CONFIG

export const MOCK_VALIDATOR_2: Validator = {
  id: Number(validator1Id),
  config: validator2Config,
  state: MOCK_VALIDATOR_2_STATE,
  pools: MOCK_VALIDATOR_2_POOLS,
  nodePoolAssignment: MOCK_VALIDATOR_2_POOL_ASSIGNMENT,
}

export const MOCK_CONSTRAINTS: Constraints = {
  epochPayoutRoundsMin: 1n,
  epochPayoutRoundsMax: 1000000n,
  minPctToValidatorWFourDecimals: 0n,
  maxPctToValidatorWFourDecimals: 1000000n,
  minEntryStake: 1000000n,
  maxAlgoPerPool: 70000000000000n,
  maxAlgoPerValidator: 300000000000000n,
  amtConsideredSaturated: 200000000000000n,
  maxNodes: 8n,
  maxPoolsPerNode: 3n,
  maxStakersPerPool: 200n,
}
