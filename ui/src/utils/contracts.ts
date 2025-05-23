import { QueryClient } from '@tanstack/react-query'
import algosdk from 'algosdk'
import { fetchAccountAssetInformation, fetchAccountInformation } from '@/api/algod'
import { fetchNfd, fetchNfdSearch } from '@/api/nfd'
import { GatingType } from '@/constants/gating'
import { Indicator } from '@/constants/indicator'
import {
  Constraints,
  NodePoolAssignmentConfig,
  ValidatorConfig,
  ValidatorCurState,
} from '@/contracts/ValidatorRegistryClient'
import { Nfd, NfdSearchV2Params } from '@/interfaces/nfd'
import { StakerValidatorData } from '@/interfaces/staking'
import { LocalPoolInfo, NodeInfo, PoolData, Validator } from '@/interfaces/validator'
import { BigMath } from '@/utils/bigint'
import { dayjs } from '@/utils/dayjs'
import { convertToBaseUnits, roundToFirstNonZeroDecimal, roundToWholeAlgos } from '@/utils/format'

/**
 * Process node pool assignment configuration data into an array with each node's available slot count
 * @param {NodePoolAssignmentConfig} nodes - Node pool assignment configuration data
 * @param {number} poolsPerNode - Number of pools per node
 * @returns {NodeInfo[]} Array of objects containing node `index` and `availableSlots`
 */
export function processNodePoolAssignment(
  nodes: NodePoolAssignmentConfig,
  poolsPerNode: number,
): NodeInfo[] {
  return nodes.nodes.map((nodeConfig, index) => {
    const availableSlots = nodeConfig[0].filter((slot, i) => i < poolsPerNode && slot === 0n).length

    return {
      index: index + 1,
      availableSlots,
    }
  })
}

/**
 * Check if a validator has available slots for more pools
 * @param {NodePoolAssignmentConfig} nodePoolAssignmentConfig - Ordered array of single `NodeConfig` arrays per pool
 * @param {number} poolsPerNode - Number of pools per node
 * @returns {boolean} Whether the validator has available slots
 */
export function validatorHasAvailableSlots(
  nodePoolAssignmentConfig: NodePoolAssignmentConfig,
  poolsPerNode: number,
): boolean {
  return nodePoolAssignmentConfig.nodes.some((nodeConfig) => {
    const slotIndex = nodeConfig[0].indexOf(0n)
    return slotIndex !== -1 && slotIndex < poolsPerNode
  })
}

/**
 * Find the first available node with a slot for a new pool
 * @param {NodePoolAssignmentConfig} nodePoolAssignmentConfig - Node pool assignment configuration data
 * @param {number} poolsPerNode - Number of pools per node
 * @returns {number | null} Node index with available slot, or null if no available slots found
 */
export function findFirstAvailableNode(
  nodePoolAssignmentConfig: NodePoolAssignmentConfig,
  poolsPerNode: number,
): number | null {
  for (let nodeIndex = 0; nodeIndex < nodePoolAssignmentConfig.nodes.length; nodeIndex++) {
    const slotIndex = nodePoolAssignmentConfig.nodes[nodeIndex][0].indexOf(0n)
    if (slotIndex !== -1 && slotIndex < poolsPerNode) {
      return nodeIndex + 1
    }
  }
  return null // No available slot found
}

/**
 * Returns the number of blocks in a given timeframe based on the average block time
 * @param {string} value - User provided value for epoch length
 * @param {string} epochTimeframe - Selected epoch timeframe unit ('blocks', 'minutes', 'hours', 'days')
 * @param {number} averageBlockTime - Average block time in milliseconds
 * @returns {number} Number of blocks in the given timeframe
 */
export function getEpochLengthBlocks(
  value: string,
  epochTimeframe: string,
  averageBlockTime: number = 0,
): number {
  if (epochTimeframe !== 'blocks' && averageBlockTime <= 0) {
    throw new Error('Average block time must be greater than zero.')
  }

  const numericValue = Number(value)
  if (isNaN(numericValue)) {
    throw new Error('Value must be a number.')
  }

  switch (epochTimeframe) {
    case 'blocks':
      return numericValue // If 'blocks', return numericValue as-is
    case 'minutes':
      return Math.floor((numericValue * 60 * 1000) / averageBlockTime)
    case 'hours':
      return Math.floor((numericValue * 60 * 60 * 1000) / averageBlockTime)
    case 'days':
      return Math.floor((numericValue * 24 * 60 * 60 * 1000) / averageBlockTime)
    default:
      return 0
  }
}

interface TransformedGatingAssets {
  entryGatingAssets: string[]
  gatingAssetMinBalance: string
}

/**
 * Prepares entry gating assets and minimum balance to submit to the contract
 * @param {string} type - Entry gating type
 * @param {Array<{ value: string }>} assetIds - Entry gating asset IDs from form input
 * @param {Array<Asset | null>} assets - Array of fetched asset objects
 * @param {string} minBalance - Minimum balance required for gating assets
 * @param {number} nfdCreatorAppId - NFD creator app ID
 * @param {number} nfdParentAppId - NFD parent app ID
 * @returns {TransformedGatingAssets} Gating assets and minimum balance prepared for submission
 */
export function transformEntryGatingAssets(
  type: string,
  assetIds: Array<{ value: string }>,
  assets: Array<algosdk.modelsv2.Asset | null>,
  minBalance: string,
  nfdCreatorAppId: bigint,
  nfdParentAppId: bigint,
): TransformedGatingAssets {
  const fixedLengthArray: string[] = new Array(4).fill('0')

  switch (type) {
    case String(GatingType.AssetId):
      for (let i = 0; i < assetIds.length && i < 4; i++) {
        fixedLengthArray[i] = assetIds[i].value !== '' ? assetIds[i].value : '0'
      }

      if (minBalance !== '' && !assets[0]) {
        throw new Error('Missing asset decimals for calculating minimum balance.')
      }

      return {
        entryGatingAssets: fixedLengthArray.sort((a, b) => Number(b) - Number(a)),
        gatingAssetMinBalance:
          minBalance === '' || assetIds.length > 1
            ? '1'
            : convertToBaseUnits(minBalance, assets[0]!.params.decimals).toString(),
      }
    case String(GatingType.CreatorNfd):
      return {
        entryGatingAssets: [nfdCreatorAppId.toString(), '0', '0', '0'],
        gatingAssetMinBalance: '1',
      }
    case String(GatingType.SegmentNfd):
      return {
        entryGatingAssets: [nfdParentAppId.toString(), '0', '0', '0'],
        gatingAssetMinBalance: '1',
      }
    default:
      return {
        entryGatingAssets: ['0', '0', '0', '0'],
        gatingAssetMinBalance: '0',
      }
  }
}

/**
 * Calculate the maximum total stake based on the validator's configuration and protocol constraints
 * @param {Validator} validator - Validator object
 * @param {Constraints} constraints - Protocol constraints object
 * @returns {bigint} Maximum total stake
 */
export function calculateMaxStake(validator: Validator, constraints?: Constraints): bigint {
  if (validator.state.numPools === 0 || !constraints) {
    return BigInt(0)
  }

  const protocolMaxStake = constraints.maxAlgoPerValidator

  const numPools = BigInt(validator.state.numPools)
  const maxAlgoPerPool = validator.config.maxAlgoPerPool || constraints.maxAlgoPerPool
  const maxStake = maxAlgoPerPool * numPools

  return maxStake < protocolMaxStake ? maxStake : protocolMaxStake
}

/**
 * Calculate the maximum number of stakers based on the validator's configuration and protocol constraints
 * @param {Validator} validator - Validator object
 * @param {Constraints} constraints - Protocol constraints object
 * @returns {number} Maximum number of stakers
 */
export function calculateMaxStakers(validator: Validator, constraints?: Constraints): number {
  const maxStakersPerPool = Number(constraints?.maxStakersPerPool || 0)
  const maxStakers = maxStakersPerPool * validator.state.numPools

  return maxStakers
}

/**
 * Check if the first pool of a validator is full
 * @param {Validator} validator - Validator object
 * @param {Constraints} constraints - Protocol constraints object
 * @returns {boolean} Whether the first pool is full
 */
export function isFirstPoolFull(validator: Validator, constraints?: Constraints): boolean {
  if (!constraints) {
    return false
  }

  const maxStakersPerPool = constraints.maxStakersPerPool || 0n

  return validator.pools.length > 0 && validator.pools[0].totalStakers >= Number(maxStakersPerPool)
}

/**
 * Check if staking is disabled based on the validator's state and protocol constraints
 * @param {string | null} activeAddress - Active wallet address
 * @param {Validator} validator - Validator object
 * @param {Constraints} constraints - Protocol constraints object
 * @returns {boolean} Whether staking is disabled
 */
export function isStakingDisabled(
  activeAddress: string | null,
  validator: Validator,
  constraints?: Constraints,
): boolean {
  if (!activeAddress) {
    return true
  }
  const { numPools, totalStakers, totalAlgoStaked } = validator.state

  const noPools = numPools === 0

  const maxStake = calculateMaxStake(validator, constraints)
  const maxStakeReached = Number(totalAlgoStaked) >= Number(maxStake)

  const maxStakersPerPool = constraints?.maxStakersPerPool || 0n
  const maxStakers = maxStakersPerPool * BigInt(numPools)
  const maxStakersReached = totalStakers >= maxStakers

  // Check if the first pool is full
  const firstPoolFull = isFirstPoolFull(validator, constraints)

  return noPools || maxStakersReached || maxStakeReached || isSunsetted(validator) || firstPoolFull
}

/**
 * Check if unstaking is disabled based on the validator's state and staking data
 * @param {string | null} activeAddress - Active wallet address
 * @param {Validator} validator - Validator object
 * @param {StakerValidatorData[]} stakesByValidator - Staking data for the active address
 * @returns {boolean} Whether unstaking is disabled
 */
export function isUnstakingDisabled(
  activeAddress: string | null,
  validator: Validator,
  stakesByValidator: StakerValidatorData[],
): boolean {
  if (!activeAddress) {
    return true
  }
  const noPools = validator.state.numPools === 0
  const validatorHasStake = stakesByValidator.some(
    (stake) => BigInt(stake.validatorId) === BigInt(validator.id),
  )

  return noPools || !validatorHasStake
}

/**
 * Check if adding a pool is disabled based on the validator's state and protocol constraints
 * @param {string | null} activeAddress - Active wallet address
 * @param {Validator} validator - Validator object
 * @param {Constraints} constraints - Protocol constraints object
 * @returns {boolean} Whether adding a pool is disabled
 */
export function isAddingPoolDisabled(
  activeAddress: string | null,
  validator: Validator,
  constraints?: Constraints,
): boolean {
  if (!activeAddress || !constraints) {
    return true
  }
  const maxNodes = Number(constraints.maxNodes)
  const { numPools } = validator.state
  const { poolsPerNode } = validator.config

  const hasAvailableSlots = numPools < poolsPerNode * maxNodes

  return !hasAvailableSlots || isSunsetted(validator)
}

/**
 * Check if a validator is sunsetting or has sunsetted
 * @param {Validator} validator - Validator object
 * @returns {boolean} Whether the validator is sunsetting or has sunsetted
 */
export function isSunsetting(validator: Validator): boolean {
  return validator.config.sunsettingOn > 0
}

/**
 * Check if a validator has sunsetted
 * @param {Validator} validator - Validator object
 * @returns {boolean} Whether the validator has sunsetted
 */
export function isSunsetted(validator: Validator): boolean {
  return validator.config.sunsettingOn > 0
    ? dayjs.unix(Number(validator.config.sunsettingOn)).isBefore(dayjs())
    : false
}

/**
 * Check if a validator has a migration set
 * @param {Validator} validator - Validator object
 * @returns {boolean} Whether the validator has a migration set
 */
export function isMigrationSet(validator: Validator): boolean {
  return validator.config.sunsettingTo > 0
}

/**
 * Check if the active address can manage a validator
 * @param {string | null} activeAddress - Active wallet address
 * @param {Validator} validator - Validator object
 * @returns {boolean} Whether the active address can manage the provided validator
 */
export function canManageValidator(activeAddress: string | null, validator: Validator): boolean {
  if (!activeAddress) {
    return false
  }
  const { owner, manager } = validator.config
  return owner === activeAddress || manager === activeAddress
}

/**
 * Returns the entry gating value to verify when adding stake.
 * Depending on the gating type, network requests may be required to fetch additional data.
 * @param {Validator | null} validator - Validator object
 * @param {string | null} activeAddress - Active wallet address
 * @param {AssetHolding[]} heldAssets - Assets held by the active address
 * @returns {number} Entry gating value to verify, or 0 if none found
 */
export async function fetchValueToVerify(
  validator: Validator | null,
  activeAddress: string | null,
  heldAssets: algosdk.modelsv2.AssetHolding[],
): Promise<bigint> {
  if (!validator || !activeAddress) {
    throw new Error('Validator or active address not found')
  }

  const { entryGatingType, entryGatingAddress, entryGatingAssets } = validator.config
  const minBalance = validator.config.gatingAssetMinBalance

  if (entryGatingType === GatingType.CreatorAccount) {
    const creatorAddress = entryGatingAddress
    const accountInfo = await fetchAccountInformation(creatorAddress)

    if (accountInfo.createdAssets) {
      const assetIds = accountInfo.createdAssets.map((asset) => BigInt(asset.index))
      return findValueToVerify(heldAssets, assetIds, minBalance)
    }
  }

  if (entryGatingType === GatingType.AssetId) {
    const assetIds = entryGatingAssets.filter((asset) => asset !== 0n)
    return findValueToVerify(heldAssets, assetIds, minBalance)
  }

  if (entryGatingType === GatingType.CreatorNfd) {
    const nfdAppId = entryGatingAssets[0]
    const nfd = await fetchNfd(nfdAppId, { view: 'tiny' })
    const addresses = nfd.caAlgo || []

    const promises = addresses.map((address) => fetchAccountInformation(address))
    const accountsInfo = await Promise.all(promises)
    const assetIds = accountsInfo
      .map((accountInfo) => accountInfo.createdAssets)
      .flat()
      .filter((asset) => !!asset)
      .map((asset) => BigInt(asset!.index))

    return findValueToVerify(heldAssets, assetIds, minBalance)
  }

  if (entryGatingType === GatingType.SegmentNfd) {
    const parentAppID = entryGatingAssets[0]

    try {
      const params: NfdSearchV2Params = {
        parentAppID,
        state: ['owned'],
        owner: activeAddress,
        view: 'brief',
        limit: 1,
      }
      const result = await fetchNfdSearch(params, { cache: false })
      if (result.nfds.length === 0) {
        return 0n
      }
      return BigInt(result.nfds[0].appID!)
    } catch (error) {
      console.error('Error fetching data:', error)
      throw error
    }
  }

  return 0n
}

/**
 * Find the first gating asset held by the active address that meets the minimum balance requirement
 * @param {AssetHolding[]} heldAssets - Assets held by the active address
 * @param {number[]} gatingAssets - Array of gating assets
 * @param {number} minBalance - Minimum balance required for gating assets
 * @returns {number} Gating asset ID that meets the minimum balance requirement or 0 if not found
 */
export function findValueToVerify(
  heldAssets: algosdk.modelsv2.AssetHolding[],
  gatingAssets: bigint[],
  minBalance: bigint,
): bigint {
  const asset = heldAssets.find(
    (asset) => gatingAssets.includes(asset.assetId) && asset.amount >= minBalance,
  )
  return asset?.assetId ?? 0n
}

/**
 * Calculate the maximum amount of algo that can be staked based on the validator's configuration
 * @param {Validator} validator - Validator object
 * @param {Constraints} constraints - Protocol constraints object
 * @returns {bigint} Maximum amount of algo that can be staked
 */
export function calculateMaxAvailableToStake(
  validator: Validator,
  constraints?: Constraints,
): bigint {
  let { maxAlgoPerPool } = validator.config

  if (maxAlgoPerPool === 0n) {
    if (!constraints) {
      return 0n
    }
    maxAlgoPerPool = constraints.maxAlgoPerPool
  }

  // For each pool, subtract the totalAlgoStaked from maxAlgoPerPool and return the highest value
  const maxAvailableToStake = validator.pools.reduce((acc, pool) => {
    const availableToStake = maxAlgoPerPool - pool.totalAlgoStaked
    return availableToStake > acc ? availableToStake : acc
  }, 0n)

  return maxAvailableToStake
}

/**
 * Calculate the effective maximum ALGO per pool based on validator config and protocol constraints
 * @param {Validator} validator - Validator object
 * @param {Constraints} constraints - Protocol constraints object
 * @returns {bigint} Effective maximum ALGO per pool in microAlgos
 */
export function calculateMaxAlgoPerPool(validator: Validator, constraints: Constraints): bigint {
  const numPools = validator.state.numPools
  const maxAlgoPerPool =
    validator.config.maxAlgoPerPool > 0n
      ? validator.config.maxAlgoPerPool
      : constraints.maxAlgoPerPool

  if (numPools === 0) {
    return maxAlgoPerPool
  }

  const hardMaxAlgoPerPool = constraints.maxAlgoPerValidator / BigInt(numPools)
  return BigMath.min(hardMaxAlgoPerPool, maxAlgoPerPool)
}

/**
 * Calculate rewards eligibility percentage for a staker based on their entry round and last pool payout round.
 * @param {number} epochRoundLength - Validator payout frequency in rounds
 * @param {number} lastPoolPayoutRound - Last pool payout round number
 * @param {number} entryRound - Staker entry round
 * @returns {number | null} Rewards eligibility percentage, or null if any input parameters are zero/undefined
 */
export function calculateRewardEligibility(
  epochRoundLength: number = 0,
  lastPoolPayoutRound: bigint = 0n,
  entryRound: bigint = 0n,
): number | null {
  if (epochRoundLength === 0 || lastPoolPayoutRound === 0n || entryRound === 0n) {
    return null
  }

  // Calculate the next payout round
  const currentEpochStartRound =
    lastPoolPayoutRound - (lastPoolPayoutRound % BigInt(epochRoundLength))
  const nextPayoutRound = currentEpochStartRound + BigInt(epochRoundLength)

  // If the entry round is greater than or equal to the next epoch, eligibility is 0%
  if (entryRound >= nextPayoutRound) {
    return 0
  }

  // Calculate the effective rounds remaining in the current epoch
  const remainingRoundsInEpoch = Math.max(0, Number(nextPayoutRound - entryRound))

  // Calculate eligibility as a percentage of the epoch length
  const eligibilePercent = (remainingRoundsInEpoch / epochRoundLength) * 100

  // Ensure eligibility is within 0-100% range
  const rewardEligibility = Math.max(0, Math.min(eligibilePercent, 100))

  // Round down to the nearest integer
  return Math.floor(rewardEligibility)
}

/**
 * Update validator data in the query cache after a mutation
 * @param {QueryClient} queryClient - Tanstack Query client instance
 * @param {Validator} data - The new validator object
 */
export function setValidatorQueriesData(queryClient: QueryClient, data: Validator): void {
  const { id, config, state, pools, nodePoolAssignment } = data
  const validatorId = String(id)

  // Update individual validator queries
  queryClient.setQueryData<ValidatorConfig>(['validator-config', validatorId], {
    id: BigInt(id),
    ...config,
  })
  queryClient.setQueryData<ValidatorCurState>(['validator-state', validatorId], state)
  queryClient.setQueryData<LocalPoolInfo[]>(['validator-pools', validatorId], pools)
  queryClient.setQueryData<NodePoolAssignmentConfig>(
    ['validator-node-pool-assignments', validatorId],
    nodePoolAssignment,
  )

  // Force refetch of num-validators to trigger dashboard update
  queryClient.invalidateQueries({ queryKey: ['num-validators'] })

  // Prefetch enrichment data if available
  if (data.rewardToken) {
    queryClient.setQueryData<algosdk.modelsv2.Asset>(
      ['asset', Number(data.config.rewardTokenId)],
      data.rewardToken,
    )
  }
  if (data.nfd) {
    queryClient.setQueryData<Nfd>(['nfd', data.config.nfdForInfo.toString()], data.nfd)
  }
  if (data.gatingAssets) {
    data.gatingAssets.forEach((asset) => {
      if (asset) {
        queryClient.setQueryData<algosdk.modelsv2.Asset>(['asset', Number(asset.index)], asset)
      }
    })
  }
}

export async function fetchRemainingRewardsBalance(validator: Validator): Promise<bigint> {
  const { rewardTokenId } = validator.config
  const { rewardTokenHeldBack } = validator.state

  if (!rewardTokenId) {
    return BigInt(0)
  }

  const poolAppId = validator.pools[0]?.poolAppId ?? 0n

  if (poolAppId === 0n) {
    throw new Error('Pool 1 not found')
  }

  const poolAddress = algosdk.getApplicationAddress(poolAppId)

  const accountAssetInfo = await fetchAccountAssetInformation(poolAddress.toString(), rewardTokenId)
  const rewardTokenAmount = accountAssetInfo.assetHolding?.amount ?? 0n

  const remainingBalance = rewardTokenAmount - rewardTokenHeldBack

  if (remainingBalance < BigInt(0)) {
    return BigInt(0)
  }

  return remainingBalance
}

export function calculateStakeSaturation(
  validator: Validator,
  constraints: Constraints,
): Indicator {
  if (!constraints) {
    return Indicator.Error
  }

  const currentStake = validator.state.totalAlgoStaked
  const maxStake = constraints.maxAlgoPerValidator
  const saturatedAmount = constraints.amtConsideredSaturated

  const nearSaturationThreshold = (saturatedAmount * BigInt(99)) / BigInt(100)

  if (currentStake >= maxStake) {
    return Indicator.Max
  } else if (currentStake > saturatedAmount) {
    return Indicator.Warning
  } else if (currentStake >= nearSaturationThreshold) {
    return Indicator.Watch
  } else {
    return Indicator.Normal
  }
}

export function calculateSaturationPercentage(
  validator: Validator,
  constraints: Constraints,
): number {
  if (!constraints) {
    return 0
  }

  const currentStake = validator.state.totalAlgoStaked
  const maxStake = constraints.maxAlgoPerValidator

  if (maxStake === BigInt(0) || currentStake === BigInt(0)) {
    return 0
  }

  // Calculate percentage as a BigInt scaled by 10000000000n (for precision)
  const scaledPercentage = (currentStake * 10000000000n) / maxStake

  // Convert percentage to a number for display
  const percentageAsNumber = Number(scaledPercentage) / 100000000

  // If the percentage is greater than or equal to 100, cap it at 100
  if (percentageAsNumber >= 100) {
    return 100
  }

  // If the percentage is between 99 and 100, round down to 99
  if (percentageAsNumber >= 99) {
    return 99
  }

  // If the percentage is less than 0.00005, round up to 0.0001
  if (percentageAsNumber < 0.00005) {
    return 0.0001
  }

  // If percentage is less than 1, round to first non-zero decimal
  if (percentageAsNumber < 1) {
    return roundToFirstNonZeroDecimal(percentageAsNumber)
  }

  // Round to nearest whole number
  return Math.round(percentageAsNumber)
}

export function calculateValidatorHealth(roundsSinceLastPayout: bigint | undefined): Indicator {
  if (!roundsSinceLastPayout || roundsSinceLastPayout >= 1200n) {
    // 1 hour
    return Indicator.Error
  } else if (roundsSinceLastPayout >= 210n) {
    // 10 minutes
    return Indicator.Warning
  } else if (roundsSinceLastPayout >= 21n) {
    // 1 minute
    return Indicator.Watch
  } else {
    return Indicator.Normal
  }
}

export function calculateValidatorPoolMetrics(
  poolsData: PoolData[],
  totalAlgoStaked: bigint,
  epochRoundLength: bigint,
  currentRound: bigint,
) {
  const totalBalances = poolsData.reduce((sum, data) => sum + data.balance, 0n)
  const oldestRound = poolsData.reduce((oldest, data) => {
    if (!data.lastPayout || data.balance === 0n) return oldest
    const nextRound = data.lastPayout - (data.lastPayout % epochRoundLength) + epochRoundLength
    return oldest === 0n || data.balance === 0n || nextRound < oldest ? nextRound : oldest
  }, 0n)

  const rewardsBalance = roundToWholeAlgos(totalBalances - totalAlgoStaked)
  const roundsSinceLastPayout = oldestRound ? currentRound - oldestRound : undefined

  // Calculate APY weighted by the pool balances
  const nonZeroBalancePools = poolsData.filter((data) => data.balance > 0n)
  const totalWeightedApy = nonZeroBalancePools.reduce((sum, data) => {
    return sum + (data.apy || 0) * Number(data.balance)
  }, 0)
  const totalBalance = nonZeroBalancePools.reduce((sum, data) => sum + Number(data.balance), 0)
  const extDeposits = nonZeroBalancePools.reduce((sum, data) => sum + Number(data.extDeposits), 0)

  const apy = totalBalance > 0 ? totalWeightedApy / totalBalance : 0

  return { rewardsBalance, roundsSinceLastPayout, apy, extDeposits }
}
