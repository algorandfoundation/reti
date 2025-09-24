import { getSimulateStakingPoolClient } from '@/api/clients'
import { StakedInfo } from '@/contracts/StakingPoolClient'
import { LocalPoolInfo, Validator } from '@/interfaces/validator'
import { getIndexerConfigFromViteEnvironment } from '@/utils/network/getAlgoClientConfigs'
import { ClientManager } from '@algorandfoundation/algokit-utils/types/client-manager'
import { hasExpectedMethod, methodSelectorToU32, processTxn } from '../utils/process-txn'

const indexerConfig = getIndexerConfigFromViteEnvironment()
const indexer = ClientManager.getIndexerClient({
  server: indexerConfig?.server ?? '',
  port: indexerConfig?.port ?? '',
  token: indexerConfig?.token ?? '',
})

export async function fetchPoolRewards(
  validator: Validator,
  poolAppId: bigint,
  roundTo?: bigint,
  roundFrom?: bigint,
): Promise<Map<string, bigint>> {
  try {
    if ((roundFrom ?? 0n) > (roundTo ?? 1n << 64n))
      throw Error('roundFrom cannot be larger than roundTo')

    const stakingPoolClient = await getSimulateStakingPoolClient(poolAppId)
    const RELEVANT_METHODS = ['addStake', 'removeStake', 'epochBalanceUpdate']
    const methodSelectors = new Map<string, number>()
    RELEVANT_METHODS.map((method) => {
      const methodSelector = stakingPoolClient.appClient.getABIMethod(method).getSelector()
      methodSelectors.set(method, methodSelectorToU32(methodSelector))
      return methodSelector
    })
    const methodSelectorSet = new Set(methodSelectors.values())

    // Get validator config
    const epochRoundLength = BigInt(validator.config.epochRoundLength)
    const percentToValidator = BigInt(validator.config.percentToValidator)
    // Init pool info
    const stakedInfo: StakedInfo[] = []
    const poolInfo: LocalPoolInfo = {
      poolId: 0n,
      poolAppId: poolAppId,
      totalStakers: 0,
      totalAlgoStaked: 0n,
    }
    const rewards = new Map<string, bigint>()
    let rewardsFrom: Map<string, bigint> | null = null

    // Get all past app calls to the pool up to round `roundTo`
    let nextToken: string | undefined = undefined
    const txns = []
    do {
      let req = await indexer.searchForTransactions().applicationID(poolAppId).txType('appl')
      if (roundTo) req = req.maxRound(roundTo)
      if (nextToken) req = req.nextToken(nextToken)
      const response = await req.do()
      // Keep just `epochUpdateBalance`, `addStake` and `removeStake` calls
      txns.push(...response.transactions.filter((txn) => hasExpectedMethod(txn, methodSelectorSet)))
      nextToken = response.nextToken
    } while (nextToken)

    // Sort txns from oldest to newest
    txns.sort((a, b) => Number(a.confirmedRound! - b.confirmedRound!))

    // Process each txn
    for (const txn of txns) {
      if (roundFrom) {
        // If roundFrom which to count rewards is defined, store stakers' rewards state at first txn that's younger
        if (txn.confirmedRound! > roundFrom && rewardsFrom === null) {
          rewardsFrom = new Map(rewards)
        }
      }

      await processTxn(txn, {
        poolAppId,
        methodSelectors,
        rewards,
        stakedInfo,
        poolInfo,
        epochRoundLength,
        percentToValidator,
      })
    }

    let rewardsPeriod = new Map<string, bigint>()
    // Calculate stakers' rewards between rounds if roundFrom is given
    // Otherwise, rewards are from start until roundTo, which is present if undefined
    if (rewardsFrom !== null) {
      for (const [address, rewardTo] of rewards) {
        const rewardFrom = rewardsFrom.get(address)
        const delta = !rewardFrom ? rewardTo : rewardTo - rewardFrom
        rewardsPeriod.set(address, delta)
      }
    } else {
      rewardsPeriod = new Map(rewards)
    }

    return rewardsPeriod
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function fetchValidatorRewards(
  validator: Validator,
  roundTo?: bigint,
  roundFrom?: bigint,
): Promise<Map<string, bigint>> {
  try {
    const stakersRewards = new Map<string, bigint>()
    for (const pool of validator.pools) {
      const poolRewards = await fetchPoolRewards(validator, pool.poolAppId, roundTo, roundFrom)
      if (poolRewards) {
        for (const [staker, poolReward] of poolRewards) {
          const reward = stakersRewards.get(staker) ?? 0n
          stakersRewards.set(staker, reward + poolReward)
        }
      }
    }
    return stakersRewards
  } catch (error) {
    console.error(error)
    throw error
  }
}
