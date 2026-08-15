import { getABIEncodedValue } from '@algorandfoundation/algokit-utils/types/app-arc56'
import { AlgoAmount } from '@algorandfoundation/algokit-utils/types/amount'
import algosdk from 'algosdk'
import { ALGORAND_ZERO_ADDRESS_STRING } from '@/constants/accounts'
import { StakedInfo } from '@/contracts/StakingPoolClient'
import {
  APP_SPEC,
  NodePoolAssignmentConfig,
  ValidatorConfig,
  ValidatorCurState,
} from '@/contracts/ValidatorRegistryClient'
import { LocalPoolInfo } from '@/interfaces/validator'
import { validatorBoxName } from '@/utils/contracts'
import { LAST_ROUND } from '@/utils/tests/constants'
import { ACCOUNT_1, ACCOUNT_2 } from '@/utils/tests/fixtures/accounts'
import {
  MOCK_VALIDATOR_1_CONFIG,
  MOCK_VALIDATOR_1_POOLS,
  MOCK_VALIDATOR_1_POOL_ASSIGNMENT,
  MOCK_VALIDATOR_1_STATE,
  MOCK_VALIDATOR_2_CONFIG,
  MOCK_VALIDATOR_2_POOLS,
  MOCK_VALIDATOR_2_POOL_ASSIGNMENT,
  MOCK_VALIDATOR_2_STATE,
} from '@/utils/tests/fixtures/validators'
import { boxNameKey, createStaticArray } from '@/utils/tests/utils'

export const DEFAULT_STAKED_INFO: StakedInfo = {
  account: ALGORAND_ZERO_ADDRESS_STRING,
  balance: BigInt(0),
  totalRewarded: BigInt(0),
  rewardTokenBalance: BigInt(0),
  entryRound: 0n,
}

export const MOCK_STAKED_INFO_1: StakedInfo = {
  account: ACCOUNT_1,
  balance: BigInt(AlgoAmount.Algos(1000).microAlgos),
  totalRewarded: BigInt(AlgoAmount.Algos(10).microAlgos),
  rewardTokenBalance: BigInt(0),
  entryRound: 1n,
}

export const MOCK_STAKED_INFO_2: StakedInfo = {
  account: ACCOUNT_2,
  balance: BigInt(AlgoAmount.Algos(2000).microAlgos),
  totalRewarded: BigInt(AlgoAmount.Algos(20).microAlgos),
  rewardTokenBalance: BigInt(0),
  entryRound: 2n,
}

interface BoxData {
  name: string
  round: number
  value: string // base64 encoded string
}

interface FixtureData {
  [appId: string]: {
    [boxName: string]: BoxData
  }
}

/** Empty slot in a validator's fixed-size pools array */
const EMPTY_POOL: [bigint, number, bigint] = [0n, 0, 0n]

/**
 * Encodes a validator's box value the same way the contract does, so decoding it in tests
 * exercises the real ARC-56 round trip rather than a hand-rolled byte layout.
 */
export function encodeValidatorInfo({
  config,
  state,
  pools,
  nodePoolAssignment,
}: {
  config: ValidatorConfig
  state: ValidatorCurState
  pools: LocalPoolInfo[]
  nodePoolAssignment: NodePoolAssignmentConfig
}): string {
  const validatorInfo = {
    config,
    state,
    pools: createStaticArray(
      pools.map(
        (pool) =>
          [pool.poolAppId, pool.totalStakers, pool.totalAlgoStaked] as [bigint, number, bigint],
      ),
      EMPTY_POOL,
      24,
    ),
    tokenPayoutRatio: {
      poolPctOfWhole: createStaticArray([], 0n, 24),
      updatedForPayout: 0n,
    },
    nodePoolAssignments: nodePoolAssignment,
  }

  const encoded = getABIEncodedValue(validatorInfo, 'ValidatorInfo', APP_SPEC.structs)
  return Buffer.from(encoded).toString('base64')
}

/**
 * Map containing each application's corresponding box fixture data.
 *
 * Keys are the box name's raw bytes, base64 encoded, so binary names (like the validator
 * boxes) work alongside plain string ones.
 */
export const boxFixtures: FixtureData = {
  '1010': {
    // Staking pool appId 1010
    [boxNameKey(Buffer.from('stakers'))]: {
      name: 'stakers',
      round: LAST_ROUND,
      value: encodeStakersToBase64(
        createStaticArray([MOCK_STAKED_INFO_1, MOCK_STAKED_INFO_2], DEFAULT_STAKED_INFO, 200),
      ),
    },
  },
  '1011': {
    // Validator 1's second staking pool - no stakers in its ledger
    [boxNameKey(Buffer.from('stakers'))]: {
      name: 'stakers',
      round: LAST_ROUND,
      value: encodeStakersToBase64(createStaticArray([], DEFAULT_STAKED_INFO, 200)),
    },
  },
  '1002': {
    // Validator registry (VITE_RETI_APP_ID in .env.test)
    [boxNameKey(validatorBoxName(1))]: {
      name: boxNameKey(validatorBoxName(1)),
      round: LAST_ROUND,
      value: encodeValidatorInfo({
        config: MOCK_VALIDATOR_1_CONFIG,
        state: MOCK_VALIDATOR_1_STATE,
        pools: MOCK_VALIDATOR_1_POOLS,
        nodePoolAssignment: MOCK_VALIDATOR_1_POOL_ASSIGNMENT,
      }),
    },
    [boxNameKey(validatorBoxName(2))]: {
      name: boxNameKey(validatorBoxName(2)),
      round: LAST_ROUND,
      value: encodeValidatorInfo({
        config: MOCK_VALIDATOR_2_CONFIG,
        state: MOCK_VALIDATOR_2_STATE,
        pools: MOCK_VALIDATOR_2_POOLS,
        nodePoolAssignment: MOCK_VALIDATOR_2_POOL_ASSIGNMENT,
      }),
    },
  },
}

/**
 * Encodes staker information into a base64 string.
 * @param {StakedInfo[]} stakers - Array of staker information.
 * @returns {string} The base64 encoded string of stakers' data.
 */
export function encodeStakersToBase64(stakers: StakedInfo[]): string {
  const bytesPerStaker = 64
  const totalBytes = stakers.length * bytesPerStaker
  const buffer = new Uint8Array(totalBytes)

  stakers.forEach((staker, index) => {
    buffer.set(algosdk.decodeAddress(staker.account).publicKey, index * bytesPerStaker)
    buffer.set(algosdk.bigIntToBytes(staker.balance, 8), index * bytesPerStaker + 32)
    buffer.set(algosdk.bigIntToBytes(staker.totalRewarded, 8), index * bytesPerStaker + 40)
    buffer.set(algosdk.bigIntToBytes(staker.rewardTokenBalance, 8), index * bytesPerStaker + 48)
    buffer.set(algosdk.bigIntToBytes(staker.entryRound, 8), index * bytesPerStaker + 56)
  })

  return Buffer.from(buffer).toString('base64')
}
