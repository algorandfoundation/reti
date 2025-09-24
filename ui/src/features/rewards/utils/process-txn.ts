import { encodeAddress } from 'algosdk'
import { getSimulateValidatorClient } from '@/api/clients'
import { ALGORAND_ZERO_ADDRESS_STRING } from '@/constants/accounts'
import { StakedInfo } from '@/contracts/StakingPoolClient'
import { LocalPoolInfo } from '@/interfaces/validator'
import { getRetiAppIdFromViteEnvironment } from '@/utils/env'
import { Transaction } from 'algosdk/dist/types/client/v2/indexer/models/types'
import { PPM_MAX } from '@/constants/units'

type processTxnContext = {
  poolAppId: bigint
  methodSelectors: Map<string, number>
  rewards: Map<string, bigint>
  stakedInfo: StakedInfo[]
  poolInfo: LocalPoolInfo
  epochRoundLength: bigint
  percentToValidator: bigint
  gtxns?: Transaction[]
}

const ALGORAND_STAKING_BLOCK_DELAY = 320n
const RETI_APP_ID = BigInt(getRetiAppIdFromViteEnvironment())
const FULL_TIME_PERCENTAGE = 1000n

export function methodSelectorToU32(methodSig: Uint8Array): number {
  return (methodSig[0] << 24) | (methodSig[1] << 16) | (methodSig[2] << 8) | methodSig[3]
}

function isExpectedMethod(txn: Transaction, methodSelectorSet: Set<number>): boolean {
  const args = txn.applicationTransaction?.applicationArgs
  if (!args || !args.length) return false
  const methodSelector = methodSelectorToU32(args[0])
  if (methodSelectorSet.has(methodSelector)) return true
  return false
}

export function hasExpectedMethod(txn: Transaction, methodSelectorSet: Set<number>): boolean {
  if (isExpectedMethod(txn, methodSelectorSet)) return true
  const innerTxns = txn.innerTxns
  if (!innerTxns) return false
  for (const innerTxn of innerTxns) {
    const has = hasExpectedMethod(innerTxn, methodSelectorSet)
    if (has) return true
  }
  return false
}

export async function processTxn(txn: Transaction, ctx: processTxnContext) {
  const {
    poolAppId,
    methodSelectors,
    rewards,
    stakedInfo,
    poolInfo,
    epochRoundLength,
    percentToValidator,
    gtxns,
  } = ctx

  const args = txn.applicationTransaction?.applicationArgs
  const appId = txn.applicationTransaction?.applicationId
  if (!args || !args.length || !appId) return

  const methodSelector = methodSelectorToU32(args[0])

  if (methodSelector === methodSelectors.get('addStake') && appId === poolAppId) {
    // Get first payTxn within the group, which should be the payment to pool
    if (!gtxns) throw Error('Processing error - impossible txn combination.')
    const payTxn = gtxns.find((_txn) => _txn.txType === 'pay')
    if (!payTxn) throw Error('Processing error - impossible txn combination.')
    const amt = payTxn.paymentTransaction!.amount
    const stakerAddress = encodeAddress(args[1])

    // Find staker
    let stakerIdx = stakedInfo.findIndex((staker) => staker.account === stakerAddress)
    if (stakerIdx === -1) {
      // Staker is new
      const stakerInfo = {
        account: stakerAddress,
        balance: 0n,
        totalRewarded: 0n,
        rewardTokenBalance: 0n,
        entryRound: 0n,
      }

      // Add it to the first unoccupied position
      const freeIdx = stakedInfo.findIndex(
        (staker) => staker.account === ALGORAND_ZERO_ADDRESS_STRING,
      )
      if (freeIdx === -1) {
        stakedInfo.push(stakerInfo)
        stakerIdx = stakedInfo.length - 1
      } else {
        stakedInfo[freeIdx] = stakerInfo
        stakerIdx = freeIdx
      }
    }
    // Update its balance
    stakedInfo[stakerIdx].balance += amt
    stakedInfo[stakerIdx].entryRound = payTxn.confirmedRound! + ALGORAND_STAKING_BLOCK_DELAY

    // Update total pool stake
    poolInfo.totalAlgoStaked += amt

    return
  } else if (methodSelector === methodSelectors.get('removeStake') && appId === poolAppId) {
    const stakerAddress = encodeAddress(args[1])

    // Find inner txn that returned the amount, so that we know staker's prior balance.
    const innerTxns = txn.innerTxns
    if (!innerTxns) throw Error('Processing error - impossible txn combination.')
    const payInnerIdx = innerTxns.findIndex((_txn) => _txn.txType === 'pay')
    const payInnerTxn = innerTxns[payInnerIdx]?.paymentTransaction
    if (!payInnerTxn) throw Error('Processing error - impossible txn combination.')
    const amt = payInnerTxn.amount

    // Find staker
    const stakerIdx = stakedInfo.findIndex((staker) => staker.account === stakerAddress)
    if (stakerIdx === -1) throw Error('Processing error - staker should be present.')

    stakedInfo[stakerIdx].balance -= amt

    // Check if staker exited the pool
    // Ideally, its balance should be 0 at that time but due to rounding that might not be exact.
    // However, the protocol does not allow balances less than 1 ALGO, so we use that as a limit.
    if (stakedInfo[stakerIdx].balance < BigInt(10 ** 6)) {
      // Delete the staker from the stakedInfo
      if (stakerIdx === stakedInfo.length - 1) {
        stakedInfo.pop()
      } else {
        stakedInfo[stakerIdx] = {
          account: ALGORAND_ZERO_ADDRESS_STRING,
          balance: 0n,
          totalRewarded: 0n,
          rewardTokenBalance: 0n,
          entryRound: 0n,
        }
      }
    }

    // Update total pool stake
    poolInfo.totalAlgoStaked -= amt

    return
  } else if (methodSelector === methodSelectors.get('epochBalanceUpdate') && appId === poolAppId) {
    const curRound = txn.confirmedRound!
    const thisEpochBegin = curRound - (curRound % epochRoundLength)

    // Get stake that was added to the pool, paid out commission, and excess to fee sink by checking inner txn
    const validatorClient = await getSimulateValidatorClient()
    const stakeUpdatedViaRewardsSelector = methodSelectorToU32(
      validatorClient.appClient.getABIMethod('stakeUpdatedViaRewards').getSelector(),
    )
    const innerTxns = txn.innerTxns
    if (!innerTxns) throw Error('Processing error - impossible txn combination.')
    const appInnerTxn = innerTxns.find((_txn) => {
      if (!isExpectedMethod(_txn, new Set([stakeUpdatedViaRewardsSelector]))) return false
      if (_txn.applicationTransaction?.applicationId !== RETI_APP_ID) return false
      return true
    })
    if (!appInnerTxn) {
      // There were no rewards to pay
      return
    }
    const increasedStake = Buffer.from(
      appInnerTxn.applicationTransaction!.applicationArgs![2],
    ).readBigUInt64BE(0)
    const validatorCommissionPaidOut = Buffer.from(
      appInnerTxn.applicationTransaction!.applicationArgs![4],
    ).readBigUInt64BE(0)
    const excessToFeeSink = Buffer.from(
      appInnerTxn.applicationTransaction!.applicationArgs![5],
    ).readBigUInt64BE(0)

    // Determine algoRewardAvail
    let algoRewardAvail = 0n
    if (validatorCommissionPaidOut !== 0n && percentToValidator !== 0n) {
      algoRewardAvail = (validatorCommissionPaidOut * PPM_MAX) / percentToValidator
      algoRewardAvail -= validatorCommissionPaidOut
    } else if (excessToFeeSink !== 0n) {
      // Need onlineStake at the time, which is unavailable
      // For simplicity, approximate with increasedStake
      algoRewardAvail = increasedStake
    }

    // Update every staker's rewards
    // First for stakers that were in the pool only partially, i.e. stakers
    // earn rewards proportionate to their stake of pool and time in pool
    const origAlgoReward = algoRewardAvail
    let partialStakersTotalStake = 0n
    for (const staker of stakedInfo) {
      const stakerAddress = staker.account
      if (stakerAddress !== ALGORAND_ZERO_ADDRESS_STRING) {
        const balanceBeforeEpoch = staker.balance
        if (staker.entryRound >= thisEpochBegin) {
          // Doesn't get any rewards
          partialStakersTotalStake += balanceBeforeEpoch
        } else {
          const timeInPool = thisEpochBegin - staker.entryRound

          // If staker is in pool full-time, it will be processed later
          if (timeInPool < epochRoundLength) {
            // Update how much stake the partial stakers had in the pool
            partialStakersTotalStake += balanceBeforeEpoch

            const timePercentage = (timeInPool * FULL_TIME_PERCENTAGE) / epochRoundLength
            const stakerReward =
              (balanceBeforeEpoch * origAlgoReward * timePercentage) /
              (poolInfo.totalAlgoStaked * FULL_TIME_PERCENTAGE)

            // Update staker's stake
            staker.balance += stakerReward
            // Explicity mark totalRewarded as 0 because total can't be tracked (easily) in one historic pass
            staker.totalRewarded = 0n
            // And how much rewards is still available got
            algoRewardAvail -= stakerReward

            // Update sum of rewards
            const stakerRewards = rewards.get(stakerAddress) ?? 0n
            rewards.set(stakerAddress, stakerRewards + stakerReward)
          }
        }
      }
    }

    if (algoRewardAvail < 0n) throw Error('Processing error - calculation error.')

    // Now for stakers that were in the pool full-time
    const newPoolTotalStake = poolInfo.totalAlgoStaked - partialStakersTotalStake
    for (const staker of stakedInfo) {
      const stakerAddress = staker.account
      if (stakerAddress !== ALGORAND_ZERO_ADDRESS_STRING && staker.entryRound < thisEpochBegin) {
        const timeInPool = thisEpochBegin - staker.entryRound
        const balanceBeforeEpoch = staker.balance

        if (timeInPool >= epochRoundLength) {
          const stakerReward = (balanceBeforeEpoch * algoRewardAvail) / newPoolTotalStake

          // Update staker's stake
          staker.balance += stakerReward
          // Explicity mark totalRewarded as 0 because total can't be tracked (easily) in one historic pass
          staker.totalRewarded = 0n

          // Update sum of rewards
          const stakerRewards = rewards.get(stakerAddress) ?? 0n
          rewards.set(stakerAddress, stakerRewards + stakerReward)
        }
      }
    }

    // Update total pool stake
    poolInfo.totalAlgoStaked += increasedStake

    return
  } else {
    const innerTxns = txn.innerTxns
    if (!innerTxns) return
    for (const innerTxn of innerTxns) {
      await processTxn(innerTxn, { ...ctx, gtxns: innerTxns })
    }
  }
}
