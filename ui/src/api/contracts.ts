import { AlgoAmount } from '@algorandfoundation/algokit-utils/types/amount'
import algosdk from 'algosdk'
import { fetchAccountBalance, fetchAsset, isOptedInToAsset } from '@/api/algod'
import {
  algorandClient,
  getSimulateStakingPoolClient,
  getSimulateValidatorClient,
  getStakingPoolClient,
  getStakingPoolFactory,
  getValidatorClient,
} from '@/api/clients'
import { fetchNfd } from '@/api/nfd'
import { ALGORAND_ZERO_ADDRESS_STRING } from '@/constants/accounts'
import { GatingType } from '@/constants/gating'
import {
  StakedInfo,
  StakedInfoFromTuple,
  StakingPoolClient,
  ValidatorPoolKey,
} from '@/contracts/StakingPoolClient'
import {
  Constraints,
  MbrAmounts,
  NodePoolAssignmentConfig,
  PoolInfo,
  ValidatorConfig,
  ValidatorCurState,
  ValidatorRegistryClient,
} from '@/contracts/ValidatorRegistryClient'
import { StakerPoolData, StakerValidatorData } from '@/interfaces/staking'
import {
  EntryGatingAssets,
  FindPoolForStakerResponse,
  LocalPoolInfo,
  PoolData,
  Validator,
  ValidatorConfigInput,
} from '@/interfaces/validator'
import { BalanceChecker } from '@/utils/balanceChecker'
import { encodeCallParams } from '@/utils/tests/abi'

export async function fetchNumValidators(): Promise<number> {
  const validatorClient = await getSimulateValidatorClient()
  const numValidators = await validatorClient.getNumValidators({ args: {} })
  return Number(numValidators)
}

export async function fetchValidatorConfig(validatorId: number | bigint): Promise<ValidatorConfig> {
  const validatorClient = await getSimulateValidatorClient()
  const config = await validatorClient.getValidatorConfig({
    args: { validatorId },
  })
  return config
}

export async function fetchValidatorState(
  validatorId: number | bigint,
): Promise<ValidatorCurState> {
  const validatorClient = await getSimulateValidatorClient()
  const state = await validatorClient.getValidatorState({
    args: { validatorId },
  })
  return state
}

export async function fetchValidatorPools(validatorId: number | bigint): Promise<LocalPoolInfo[]> {
  const validatorClient = await getSimulateValidatorClient()
  const poolsData = await validatorClient.getPools({
    args: { validatorId },
    note: encodeCallParams('getPools', { validatorId }), // Used by MSW in tests
  })

  const poolAddresses: string[] = []
  const poolAlgodVersions: (string | undefined)[] = []

  for (const poolInfo of poolsData) {
    const stakingPoolClient = await getSimulateStakingPoolClient(poolInfo[0])

    poolAddresses.push(stakingPoolClient.appAddress.toString())
    poolAlgodVersions.push((await stakingPoolClient.state.global.algodVer()).asString())
  }

  // Transform raw pool data into LocalPoolInfo[]
  return poolsData.map(
    (poolInfo: [bigint, number, bigint], i: number) =>
      ({
        poolId: BigInt(i + 1),
        poolAppId: poolInfo[0],
        totalStakers: poolInfo[1],
        totalAlgoStaked: poolInfo[2],
        poolAddress: poolAddresses[i],
        algodVersion: poolAlgodVersions[i],
      }) satisfies LocalPoolInfo,
  )
}

export async function fetchValidatorNodePoolAssignments(
  validatorId: number | bigint,
): Promise<NodePoolAssignmentConfig> {
  const validatorClient = await getSimulateValidatorClient()
  const assignments = await validatorClient.getNodePoolAssignments({
    args: { validatorId },
  })
  return assignments
}

/**
 * Creates a base validator object from the validator data
 */
export function createBaseValidator({
  id,
  config,
  state,
  pools,
  nodePoolAssignment,
}: {
  id: number
  config: Omit<ValidatorConfig, 'id'>
  state: ValidatorCurState
  pools: LocalPoolInfo[]
  nodePoolAssignment: NodePoolAssignmentConfig
}): Validator {
  return {
    id,
    config,
    state,
    pools,
    nodePoolAssignment,
  }
}

export async function processPoolData(pool: LocalPoolInfo): Promise<PoolData> {
  const poolAddress = algosdk.getApplicationAddress(pool.poolAppId)
  const poolBalance = await fetchAccountBalance(poolAddress.toString(), true)

  const poolData: PoolData = { balance: poolBalance }

  if (poolData.balance === 0n) {
    return poolData
  }

  const stakingPoolClient = await getSimulateStakingPoolClient(pool.poolAppId)
  const stakingPoolGS = await stakingPoolClient.state.global.getAll()
  poolData.lastPayout = stakingPoolGS.lastPayout

  const ewma = stakingPoolGS.weightedMovingAverage
  poolData.apy = ewma ? (Number(ewma) / 10000) * 100 : undefined

  return poolData
}

/**
 * Fetches all validator data and enrichment data in parallel. Used after adding a new validator
 * to seed the query cache with complete data.
 */
export async function fetchValidator(validatorId: number): Promise<Validator> {
  const [config, state, pools, nodePoolAssignment] = await Promise.all([
    fetchValidatorConfig(validatorId),
    fetchValidatorState(validatorId),
    fetchValidatorPools(validatorId),
    fetchValidatorNodePoolAssignments(validatorId),
  ])

  if (!config || !state || !pools || !nodePoolAssignment) {
    throw new ValidatorNotFoundError(`Validator with id "${validatorId}" not found!`)
  }

  // Create base validator
  const validator = createBaseValidator({
    id: validatorId,
    config,
    state,
    pools,
    nodePoolAssignment,
  })

  // Fetch all enrichment data in parallel
  const enrichmentPromises: Promise<void>[] = []

  if (validator.config.rewardTokenId > 0) {
    enrichmentPromises.push(
      fetchAsset(validator.config.rewardTokenId).then((token) => {
        validator.rewardToken = token
      }),
    )
  }

  if (validator.config.entryGatingType === GatingType.AssetId) {
    enrichmentPromises.push(
      Promise.all(
        validator.config.entryGatingAssets.map(async (assetId) => {
          if (assetId > 0) {
            return fetchAsset(assetId)
          }
          return null
        }),
      ).then((assets) => {
        validator.gatingAssets = assets.filter(Boolean) as algosdk.modelsv2.Asset[]
      }),
    )
  }

  if (validator.config.nfdForInfo > 0) {
    enrichmentPromises.push(
      fetchNfd(validator.config.nfdForInfo, { view: 'full' }).then((nfd) => {
        validator.nfd = nfd
      }),
    )
  }

  // Wait for all enrichment data
  if (enrichmentPromises.length > 0) {
    await Promise.all(enrichmentPromises)
  }

  return validator
}

export class ValidatorNotFoundError extends Error {}

export async function addValidator(
  values: ValidatorConfigInput,
  nfdAppId: bigint,
  signer: algosdk.TransactionSigner,
  activeAddress: string,
) {
  const validatorClient = await getValidatorClient(signer, activeAddress)

  const { addValidatorMbr } = (
    await validatorClient.send.getMbrAmounts({
      args: {},
    })
  ).return!

  const payValidatorMbr = await validatorClient.appClient.createTransaction.fundAppAccount({
    sender: activeAddress,
    amount: AlgoAmount.MicroAlgo(addValidatorMbr),
    extraFee: AlgoAmount.Algos(10),
  })

  // Check balance
  const requiredBalance = (payValidatorMbr.payment?.amount ?? 0n) + payValidatorMbr.fee + 1000n
  await BalanceChecker.check(activeAddress, requiredBalance, 'Add validator')

  const entryGatingType = Number(values.entryGatingType || 0)
  const entryGatingAddress = values.entryGatingAddress || ALGORAND_ZERO_ADDRESS_STRING
  const entryGatingAssets = new Array(4).fill(0n) as EntryGatingAssets

  for (let i = 0; i < values.entryGatingAssets.length && i < 4; i++) {
    entryGatingAssets[i] = BigInt(values.entryGatingAssets[i] ?? 0n)
  }

  const validatorConfig: ValidatorConfig = {
    id: 0n, // id not known yet
    owner: values.owner,
    manager: values.manager,
    nfdForInfo: nfdAppId,
    entryGatingType,
    entryGatingAddress,
    entryGatingAssets,
    gatingAssetMinBalance: BigInt(values.gatingAssetMinBalance || 0),
    rewardTokenId: BigInt(values.rewardTokenId) ?? 0n,
    rewardPerPayout: BigInt(values.rewardPerPayout) ?? 0n,
    epochRoundLength: Number(values.epochRoundLength),
    percentToValidator: Math.round(Number(values.percentToValidator) * 10000),
    validatorCommissionAddress: values.validatorCommissionAddress,
    minEntryStake: AlgoAmount.Algos(Number(values.minEntryStake)).microAlgos,
    maxAlgoPerPool: 0n,
    poolsPerNode: Number(values.poolsPerNode),
    sunsettingOn: 0n,
    sunsettingTo: 0n,
  }

  const result = await validatorClient
    .newGroup()
    .addValidator({
      args: {
        mbrPayment: payValidatorMbr,
        nfdName: values.nfdForInfo || '',
        config: validatorConfig,
      },
    })
    .send({ populateAppCallResources: true })

  return Number(result.returns![0])
}

export function callGetMbrAmounts(validatorClient: ValidatorRegistryClient) {
  return validatorClient.send.getMbrAmounts({ args: {} })
}

export async function fetchMbrAmounts(client?: ValidatorRegistryClient): Promise<MbrAmounts> {
  try {
    const validatorClient = client || (await getSimulateValidatorClient())

    return (await callGetMbrAmounts(validatorClient)).return!
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function addStakingPool(
  validatorId: bigint,
  nodeNum: number,
  poolMbr: bigint,
  signer: algosdk.TransactionSigner,
  activeAddress: string,
): Promise<ValidatorPoolKey> {
  const validatorClient = await getValidatorClient(signer, activeAddress)

  const payValidatorAddPoolMbr = await validatorClient.appClient.createTransaction.fundAppAccount({
    sender: activeAddress,
    amount: AlgoAmount.MicroAlgo(poolMbr),
  })

  // Check balance
  const requiredBalance =
    (payValidatorAddPoolMbr.payment?.amount ?? 0n) +
    payValidatorAddPoolMbr.fee +
    1000n +
    1000n +
    2000n

  await BalanceChecker.check(activeAddress, requiredBalance, 'Add staking pool')

  const addPoolResponse = await validatorClient
    .newGroup()
    .gas({ args: {}, note: '1' })
    .gas({ args: {}, note: '2' })
    .addPool({
      args: { mbrPayment: payValidatorAddPoolMbr, validatorId, nodeNum },
      extraFee: AlgoAmount.MicroAlgos(1000),
      sender: activeAddress,
      validityWindow: 100,
    })
    .send({ populateAppCallResources: true })

  return addPoolResponse.returns![2]!
}

export async function initStakingPoolStorage(
  poolAppId: bigint,
  poolInitMbr: bigint,
  optInRewardToken: boolean,
  signer: algosdk.TransactionSigner,
  activeAddress: string,
): Promise<void> {
  const suggestedParams = await algorandClient.getSuggestedParams()
  const mbrAmount = optInRewardToken ? poolInitMbr + AlgoAmount.Algos(0.1).microAlgos : poolInitMbr

  const payPoolInitStorageMbr = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: activeAddress,
    receiver: algosdk.getApplicationAddress(poolAppId),
    amount: mbrAmount,
    suggestedParams,
  })

  // Check balance
  const requiredBalance =
    (payPoolInitStorageMbr.payment?.amount ?? 0n) +
    payPoolInitStorageMbr.fee +
    1000n +
    1000n +
    3000n

  await BalanceChecker.check(activeAddress, requiredBalance, 'Pool storage requirement payment')

  const stakingPoolClient = await getStakingPoolClient(poolAppId, signer, activeAddress)

  await stakingPoolClient
    .newGroup()
    .gas({ args: {}, note: '1' })
    .gas({ args: {}, note: '2' })
    .initStorage({
      args: {
        // the required MBR payment transaction
        mbrPayment: payPoolInitStorageMbr,
      },
      extraFee: AlgoAmount.MicroAlgos(2000),
    })
    .send({ populateAppCallResources: true })
}

export async function doesStakerNeedToPayMbr(
  activeAddress: string,
  authAddr?: string,
  client?: ValidatorRegistryClient,
): Promise<boolean> {
  const validatorClient = client || (await getSimulateValidatorClient(activeAddress))

  const result = await validatorClient.send.doesStakerNeedToPayMbr({
    args: { staker: activeAddress },
  })

  if (result.returns?.[0] === undefined) {
    throw new Error('Error checking if staker needs to pay MBR')
  }
  return result.return!
}

export async function findPoolForStaker(
  validatorId: number,
  amountToStake: bigint,
  activeAddress: string,
  authAddr?: string,
  client?: ValidatorRegistryClient,
): Promise<FindPoolForStakerResponse> {
  const validatorClient = client || (await getSimulateValidatorClient(activeAddress))

  const result = await validatorClient
    .newGroup()
    .gas({
      args: {},
    })
    .findPoolForStaker({
      args: {
        validatorId,
        staker: activeAddress,
        amountToStake,
      },
      extraFee: AlgoAmount.MicroAlgos(1000),
    })
    .simulate({ skipSignatures: true, allowUnnamedResources: true })

  const errorMessage = result.simulateResponse.txnGroups[0].failureMessage

  if (errorMessage || !result.returns[1]) {
    throw new Error(`Error finding pool for staker: ${errorMessage || 'No pool found'}`)
  }
  const [[valId, poolId, poolAppId], isNewStakerToValidator, isNewStakerToProtocol] =
    result.returns[1]

  const poolKey: ValidatorPoolKey = {
    id: valId,
    poolId: poolId,
    poolAppId: poolAppId,
  }

  return { poolKey, isNewStakerToValidator, isNewStakerToProtocol }
}

export async function addStake(
  validatorId: number,
  stakeAmount: bigint, // microalgos
  valueToVerify: bigint,
  rewardTokenId: bigint,
  signer: algosdk.TransactionSigner,
  activeAddress: string,
): Promise<ValidatorPoolKey> {
  const validatorClient = await getValidatorClient(signer, activeAddress)
  const suggestedParams = await algorandClient.getSuggestedParams()

  const stakeTransferPayment = await validatorClient.appClient.createTransaction.fundAppAccount({
    sender: activeAddress,
    amount: AlgoAmount.MicroAlgo(stakeAmount),
  })

  const needsOptInTxn = rewardTokenId > 0 && !(await isOptedInToAsset(activeAddress, rewardTokenId))

  const simulateValidatorClient = await getSimulateValidatorClient(activeAddress)

  const simulateComposer = simulateValidatorClient
    .newGroup()
    .gas({ args: [], note: '1' })
    .gas({ args: [], note: '2' })
    .addStake({
      args: {
        stakedAmountPayment: stakeTransferPayment,
        validatorId,
        valueToVerify,
      },
      staticFee: AlgoAmount.MicroAlgos(240_000),
      validityWindow: 200,
    })

  if (needsOptInTxn) {
    const rewardTokenOptInTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      sender: activeAddress,
      receiver: activeAddress,
      amount: 0,
      assetIndex: Number(rewardTokenId),
      suggestedParams,
    })

    simulateComposer.addTransaction(rewardTokenOptInTxn)
  }

  const simulateResults = await simulateComposer.simulate({
    skipSignatures: true,
    allowUnnamedResources: true,
  })

  stakeTransferPayment.group = undefined

  const feeAmount = AlgoAmount.MicroAlgos(
    1000 *
      Math.floor(
        ((simulateResults.simulateResponse.txnGroups[0].appBudgetAdded as number) + 699) / 700,
      ) -
      1000, // subtract back out the opcodes added from the gas call(s) which were paid as part of their normal fees,
  )

  let requiredBalance =
    (stakeTransferPayment.payment?.amount ?? 0n) + stakeTransferPayment.fee + feeAmount.microAlgos

  const composer = validatorClient
    .newGroup()
    .gas({ args: [], note: '1' })
    .gas({ args: [], note: '2' })
    .addStake({
      args: {
        // --
        // This is the actual send of stake to the validator contract (which then sends to the staking pool)
        stakedAmountPayment: { txn: stakeTransferPayment, signer },
        // --
        validatorId,
        valueToVerify,
      },
      extraFee: feeAmount,
    })

  if (needsOptInTxn) {
    const rewardTokenOptInTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      sender: activeAddress,
      receiver: activeAddress,
      amount: 0,
      assetIndex: Number(rewardTokenId),
      suggestedParams,
    })

    requiredBalance += rewardTokenOptInTxn.fee

    composer.addTransaction(rewardTokenOptInTxn)
  }

  // Check balance
  await BalanceChecker.check(activeAddress, requiredBalance, 'Add stake')

  const result = await composer.send({ populateAppCallResources: true })

  return result.returns![2]!
}

export async function callFindPoolForStaker(
  validatorId: number | bigint,
  staker: string,
  amountToStake: bigint,
  validatorClient: ValidatorRegistryClient,
) {
  return validatorClient.send.findPoolForStaker({ args: { validatorId, staker, amountToStake } })
}

export async function isNewStakerToValidator(
  validatorId: number | bigint,
  staker: string,
  minEntryStake: bigint,
) {
  const validatorClient = await getSimulateValidatorClient()
  const result = await callFindPoolForStaker(validatorId, staker, minEntryStake, validatorClient)

  const [_, isNewStaker] = result.return!

  return isNewStaker
}

export async function callGetStakedPoolsForAccount(
  staker: string,
  validatorClient: ValidatorRegistryClient,
) {
  return validatorClient.send.getStakedPoolsForAccount({ args: { staker } })
}

export async function fetchStakedPoolsForAccount(staker: string): Promise<ValidatorPoolKey[]> {
  try {
    const validatorClient = await getSimulateValidatorClient()
    const result = await callGetStakedPoolsForAccount(staker, validatorClient)

    const stakedPools = result.return!

    // Filter out potential duplicates (temporary UI fix for duplicate staked pools bug)
    const uniqueStakedPools = Array.from(
      new Set(stakedPools.map((sp) => JSON.stringify(sp.map((v) => Number(v))))),
    ).map((sp) => JSON.parse(sp) as (typeof stakedPools)[0])

    // return uniqueStakedPools
    return uniqueStakedPools.map(([validatorId, poolId, poolAppId]) => ({
      id: validatorId,
      poolId: poolId,
      poolAppId: poolAppId,
    }))
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function callGetStakerInfo(staker: string, stakingPoolClient: StakingPoolClient) {
  return stakingPoolClient.getStakerInfo({
    args: { staker },
    extraFee: AlgoAmount.MicroAlgos(3000),
  })
}

export async function fetchStakerPoolData(
  poolKey: ValidatorPoolKey,
  staker: string,
): Promise<StakerPoolData> {
  try {
    const stakingPoolClient = await getSimulateStakingPoolClient(poolKey.poolAppId)
    const stakingPoolGS = await stakingPoolClient.appClient.getGlobalState()

    let lastPayoutRound: bigint = 0n

    if (stakingPoolGS.lastPayout !== undefined) {
      lastPayoutRound = BigInt(stakingPoolGS.lastPayout.value)
    }

    const stakedInfo = await callGetStakerInfo(staker, stakingPoolClient)!

    return {
      ...stakedInfo,
      poolKey,
      lastPayout: lastPayoutRound,
    }
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function fetchStakerValidatorData(staker: string): Promise<StakerValidatorData[]> {
  try {
    const poolKeys = await fetchStakedPoolsForAccount(staker)

    const allPools: Array<StakerPoolData> = []
    const batchSize = 10

    for (let i = 0; i < poolKeys.length; i += batchSize) {
      const batchPromises = Array.from(
        { length: Math.min(batchSize, poolKeys.length - i) },
        (_, index) => {
          const poolKey = poolKeys[i + index]
          return fetchStakerPoolData(poolKey, staker)
        },
      )

      // Run batch calls in parallel
      const batchResults = await Promise.all(batchPromises)

      allPools.push(...batchResults)
    }

    // Group pool stakes by validatorId and sum up balances
    const stakerValidatorData = allPools.reduce((acc, pool) => {
      const { id: validatorId } = pool.poolKey

      // Check if we already have an entry for this validator
      const existingData = acc.find((data) => data.validatorId === validatorId)

      if (existingData) {
        // staker is in another pool for this validator, update validator totals
        existingData.balance += pool.balance
        existingData.totalRewarded += pool.totalRewarded
        existingData.rewardTokenBalance += pool.rewardTokenBalance
        existingData.entryRound =
          pool.entryRound > existingData.entryRound ? pool.entryRound : existingData.entryRound
        existingData.lastPayout =
          existingData.lastPayout > pool.lastPayout ? existingData.lastPayout : pool.lastPayout
        existingData.pools.push(pool) // add pool to existing StakerPoolData[]
      } else {
        // First pool for this validator, add new entry
        acc.push({
          validatorId,
          balance: pool.balance,
          totalRewarded: pool.totalRewarded,
          rewardTokenBalance: pool.rewardTokenBalance,
          entryRound: pool.entryRound,
          lastPayout: pool.lastPayout,
          pools: [pool], // add pool to new StakerPoolData[]
        })
      }

      return acc
    }, [] as StakerValidatorData[])

    return stakerValidatorData
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function callGetProtocolConstraints(validatorClient: ValidatorRegistryClient) {
  return validatorClient.send.getProtocolConstraints({ args: {} })
}

export async function fetchProtocolConstraints(
  client?: ValidatorRegistryClient,
): Promise<Constraints> {
  try {
    const validatorClient = client || (await getSimulateValidatorClient())
    return (await callGetProtocolConstraints(validatorClient)).return!
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function removeStake(
  poolAppId: bigint,
  amountToUnstake: bigint,
  rewardTokenId: bigint,
  signer: algosdk.TransactionSigner,
  activeAddress: string,
) {
  const suggestedParams = await algorandClient.getSuggestedParams()

  const stakingPoolSimulateClient = await getSimulateStakingPoolClient(poolAppId, activeAddress)

  const needsOptInTxn = rewardTokenId > 0 && !(await isOptedInToAsset(activeAddress, rewardTokenId))

  const simulateComposer = stakingPoolSimulateClient
    .newGroup()
    .gas({ args: [], note: '1', staticFee: AlgoAmount.MicroAlgos(0) })
    .gas({ args: [], note: '2', staticFee: AlgoAmount.MicroAlgos(0) })
    .removeStake({
      args: { staker: activeAddress, amountToUnstake },
      staticFee: AlgoAmount.MicroAlgos(240000),
    })

  if (needsOptInTxn) {
    const rewardTokenOptInTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      sender: activeAddress,
      receiver: activeAddress,
      amount: 0,
      assetIndex: Number(rewardTokenId),
      suggestedParams,
    })

    simulateComposer.addTransaction(rewardTokenOptInTxn)
  }

  const simulateResult = await simulateComposer.simulate({
    skipSignatures: true,
    allowUnnamedResources: true,
  })

  const feeAmount = AlgoAmount.MicroAlgos(
    1000 *
      Math.floor(
        ((simulateResult.simulateResponse.txnGroups[0].appBudgetAdded as number) + 699) / 700,
      ) -
      2000, // subtract back out the opcodes added from the two gas calls which were paid as part of their normal fees,
  )

  let requiredBalance = feeAmount.microAlgos

  const stakingPoolClient = await getStakingPoolClient(poolAppId, signer, activeAddress)

  const composer = stakingPoolClient
    .newGroup()
    .gas({ args: [], note: '1' })
    .gas({ args: [], note: '2' })
    .removeStake({
      args: { staker: activeAddress, amountToUnstake },
      extraFee: feeAmount,
    })

  if (needsOptInTxn) {
    const rewardTokenOptInTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      sender: activeAddress,
      receiver: activeAddress,
      amount: 0,
      assetIndex: Number(rewardTokenId),
      suggestedParams,
    })

    requiredBalance += rewardTokenOptInTxn.fee

    composer.addTransaction(rewardTokenOptInTxn)
  }

  // Check balance
  await BalanceChecker.check(activeAddress, requiredBalance, 'Remove stake')

  await composer.send({ populateAppCallResources: true })
}

export async function epochBalanceUpdate(
  poolAppId: bigint,
  signer: algosdk.TransactionSigner,
  activeAddress: string,
): Promise<void> {
  try {
    const stakingPoolSimulateClient = await getSimulateStakingPoolClient(poolAppId, activeAddress)

    const simulateResult = await stakingPoolSimulateClient
      .newGroup()
      .gas({
        args: [],
        note: '1',
        staticFee: AlgoAmount.MicroAlgos(0),
      })
      .gas({
        args: [],
        note: '2',
        staticFee: AlgoAmount.MicroAlgos(0),
      })
      .epochBalanceUpdate({
        args: {},
        staticFee: AlgoAmount.MicroAlgos(240_000),
      })
      .simulate({ skipSignatures: true, allowUnnamedResources: true })

    const feeAmount = AlgoAmount.MicroAlgos(
      1000 *
        Math.floor(
          ((simulateResult.simulateResponse.txnGroups[0].appBudgetAdded as number) + 699) / 700,
        ) -
        2000, // subtract back out the opcodes added from the gas call(s) which were paid as part of their normal fees,
    )

    // Check balance
    const requiredBalance = feeAmount.microAlgos
    await BalanceChecker.check(activeAddress, requiredBalance, 'Epoch balance update')

    const stakingPoolClient = await getStakingPoolClient(poolAppId, signer, activeAddress)

    await stakingPoolClient
      .newGroup()
      .gas({ args: [], note: '1' })
      .gas({ args: [], note: '2' })
      .epochBalanceUpdate({ args: {}, extraFee: feeAmount })
      .send({ populateAppCallResources: true })
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function callGetPoolInfo(
  poolKey: ValidatorPoolKey,
  validatorClient: ValidatorRegistryClient,
) {
  return validatorClient.send.getPoolInfo({ args: { poolKey } })
}

export async function fetchPoolInfo(
  poolKey: ValidatorPoolKey,
  client?: ValidatorRegistryClient,
): Promise<LocalPoolInfo> {
  try {
    const validatorClient = client || (await getSimulateValidatorClient())

    const result = await callGetPoolInfo(poolKey, validatorClient)
    const poolInfo = result.return!

    const stakingPoolClient = await getSimulateStakingPoolClient(poolKey.poolAppId)
    const poolAddress = stakingPoolClient.appAddress.toString()

    return {
      poolId: poolKey.poolId,
      poolAppId: poolInfo.poolAppId,
      totalStakers: poolInfo.totalStakers,
      totalAlgoStaked: poolInfo.totalAlgoStaked,
      poolAddress,
    }
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function claimTokens(
  pools: PoolInfo[],
  signer: algosdk.TransactionSigner,
  activeAddress: string,
) {
  const [algorand, stakingFactory] = getStakingPoolFactory()

  const feeComposer = algorand.newGroup()

  for (const pool of pools) {
    const client = stakingFactory.getAppClientById({
      appId: pool.poolAppId,
      defaultSender: activeAddress,
    })
    feeComposer
      .addAppCallMethodCall(
        await client.params.gas({ args: [], note: '1', staticFee: (0).microAlgo() }),
      )
      .addAppCallMethodCall(
        await client.params.gas({ args: [], note: '2', staticFee: (0).microAlgo() }),
      )
      .addAppCallMethodCall(
        await client.params.claimTokens({ args: {}, staticFee: (240_000).microAlgo() }),
      )
  }

  const simulateResult = await feeComposer.simulate({
    skipSignatures: true,
    allowUnnamedResources: true,
  })

  const feeAmount = AlgoAmount.MicroAlgos(
    1000 *
      Math.floor(
        ((simulateResult.simulateResponse.txnGroups[0].appBudgetAdded as number) + 699) / 700,
      ) -
      2000, // subtract back out the opcodes added from the gas call(s) which were paid as part of their normal fees,
  )

  const composer = algorand.newGroup()

  for (const pool of pools) {
    const client = stakingFactory.getAppClientById({
      appId: pool.poolAppId,
      // Assumes this address was registered already with the AlgorandClient and the use-wallet signer
      defaultSender: activeAddress,
      defaultSigner: signer,
    })
    composer
      .addAppCallMethodCall(await client.params.gas({ args: [], note: '1' }))
      .addAppCallMethodCall(await client.params.gas({ args: [], note: '2' }))
      .addAppCallMethodCall(await client.params.claimTokens({ args: {}, extraFee: feeAmount }))
  }

  await composer.send({ populateAppCallResources: true })
}

export async function fetchStakedInfoForPool(poolAppId: bigint): Promise<StakedInfo[]> {
  try {
    const stakingPoolClient = await getSimulateStakingPoolClient(poolAppId)
    const stakers = await stakingPoolClient.state.box.stakers()
    return stakers!
      .map((s): StakedInfo => StakedInfoFromTuple(s))
      .filter((staker) => staker.account !== ALGORAND_ZERO_ADDRESS_STRING)
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function changeValidatorManager(
  validatorId: number | bigint,
  manager: string,
  signer: algosdk.TransactionSigner,
  activeAddress: string,
) {
  const validatorClient = await getValidatorClient(signer, activeAddress)

  // Check balance
  await BalanceChecker.check(activeAddress, 1000n, 'Change validator manager')

  validatorClient.send.changeValidatorManager({
    args: { validatorId, manager },
    populateAppCallResources: true,
  })
}

export async function changeValidatorSunsetInfo(
  validatorId: number | bigint,
  sunsettingOn: number,
  sunsettingTo: number,
  signer: algosdk.TransactionSigner,
  activeAddress: string,
) {
  const validatorClient = await getValidatorClient(signer, activeAddress)

  // Check balance
  await BalanceChecker.check(activeAddress, 1000n, 'Change validator sunset info')

  return validatorClient.send.changeValidatorSunsetInfo({
    args: { validatorId, sunsettingOn, sunsettingTo },
    populateAppCallResources: true,
  })
}

export async function changeValidatorNfd(
  validatorId: number | bigint,
  nfdAppId: bigint,
  nfdName: string,
  signer: algosdk.TransactionSigner,
  activeAddress: string,
) {
  const validatorClient = await getValidatorClient(signer, activeAddress)

  // Check balance
  await BalanceChecker.check(activeAddress, 1000n, 'Change validator NFD')

  return validatorClient.send.changeValidatorNfd({
    args: { validatorId, nfdAppId, nfdName },
    extraFee: AlgoAmount.MicroAlgos(1000),
    populateAppCallResources: true,
  })
}

export async function changeValidatorCommissionAddress(
  validatorId: number | bigint,
  commissionAddress: string,
  signer: algosdk.TransactionSigner,
  activeAddress: string,
) {
  const validatorClient = await getValidatorClient(signer, activeAddress)

  // Check balance
  await BalanceChecker.check(activeAddress, 1000n, 'Change validator commission address')

  return validatorClient.send.changeValidatorCommissionAddress({
    args: { validatorId, commissionAddress },
    populateAppCallResources: true,
  })
}

export async function changeValidatorRewardInfo(
  validatorId: number | bigint,
  entryGatingType: number,
  entryGatingAddress: string,
  entryGatingAssets: EntryGatingAssets,
  gatingAssetMinBalance: bigint,
  rewardPerPayout: bigint,
  signer: algosdk.TransactionSigner,
  activeAddress: string,
) {
  const validatorClient = await getValidatorClient(signer, activeAddress)

  // Check balance
  await BalanceChecker.check(activeAddress, 1000n, 'Change validator reward info')

  return validatorClient.send.changeValidatorRewardInfo({
    args: {
      validatorId,
      entryGatingType,
      entryGatingAddress,
      entryGatingAssets,
      gatingAssetMinBalance,
      rewardPerPayout,
    },
    populateAppCallResources: true,
  })
}

export async function fetchPoolApy(poolAppId: bigint): Promise<number> {
  try {
    const stakingPoolClient = await getSimulateStakingPoolClient(poolAppId)
    const ewma = await stakingPoolClient.state.global.weightedMovingAverage()

    if (!ewma) {
      throw new Error(`Error fetching EWMA for pool ${poolAppId}`)
    }
    const poolApy = (Number(ewma) / 10000) * 100

    return poolApy
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function linkPoolToNfd(
  poolAppId: bigint,
  nfdName: string,
  nfdAppId: number,
  signer: algosdk.TransactionSigner,
  activeAddress: string,
) {
  try {
    const nfdAppAddress = algosdk.getApplicationAddress(nfdAppId)
    const poolAppAddress = algosdk.getApplicationAddress(poolAppId)

    const boxStorageMbrAmount = AlgoAmount.MicroAlgos(20500)
    const feeAmount = AlgoAmount.MicroAlgos(5000)

    const payBoxStorageMbrTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: activeAddress,
      receiver: nfdAppAddress,
      amount: boxStorageMbrAmount.microAlgos,
      suggestedParams: await algorandClient.getSuggestedParams(),
    })

    const updateNfdAppCall = algosdk.makeApplicationNoOpTxnFromObject({
      appIndex: nfdAppId,
      sender: activeAddress,
      suggestedParams: await algorandClient.getSuggestedParams(),
      appArgs: [
        new TextEncoder().encode('update_field'),
        new TextEncoder().encode('u.cav.algo.a'),
        poolAppAddress.publicKey,
      ],
    })

    // Check balance
    const requiredBalance =
      (payBoxStorageMbrTxn.payment?.amount ?? 0n) +
      payBoxStorageMbrTxn.fee +
      updateNfdAppCall.fee +
      feeAmount.microAlgos

    await BalanceChecker.check(activeAddress, requiredBalance, 'Link pool to NFD')

    const stakingPoolClient = await getStakingPoolClient(poolAppId, signer, activeAddress)

    await stakingPoolClient
      .newGroup()
      .addTransaction(payBoxStorageMbrTxn)
      .addTransaction(updateNfdAppCall)
      .linkToNfd({ args: { nfdAppId, nfdName }, extraFee: feeAmount })
      .send({ populateAppCallResources: true })
  } catch (error) {
    console.error(error)
    throw error
  }
}
