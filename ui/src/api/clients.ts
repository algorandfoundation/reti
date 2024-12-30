import algosdk from 'algosdk'
import { FEE_SINK } from '@/constants/accounts'
import { StakingPoolClient, StakingPoolFactory } from '@/contracts/StakingPoolClient'
import { ValidatorRegistryClient } from '@/contracts/ValidatorRegistryClient'
import { getRetiAppIdFromViteEnvironment } from '@/utils/env'
import { getAlgodConfigFromViteEnvironment } from '@/utils/network/getAlgoClientConfigs'
import { AlgorandClient } from '@algorandfoundation/algokit-utils'

const algodConfig = getAlgodConfigFromViteEnvironment()
const algorandClient = AlgorandClient.fromConfig({ algodConfig }).setDefaultValidityWindow(200)

const RETI_APP_ID = BigInt(getRetiAppIdFromViteEnvironment())

export function getStakingPoolFactory(): [AlgorandClient, StakingPoolFactory] {
  return [algorandClient, new StakingPoolFactory({ algorand: algorandClient })]
}

export async function getValidatorClient(
  signer: algosdk.TransactionSigner,
  activeAddress: string,
): Promise<ValidatorRegistryClient> {
  algorandClient.setSigner(activeAddress, signer)
  return algorandClient.client.getTypedAppClientById(ValidatorRegistryClient, {
    defaultSender: activeAddress,
    appId: RETI_APP_ID,
  })
}

export async function getSimulateValidatorClient(
  senderAddr: string = FEE_SINK,
): Promise<ValidatorRegistryClient> {
  return algorandClient.client.getTypedAppClientById(ValidatorRegistryClient, {
    defaultSender: senderAddr,
    appId: RETI_APP_ID,
  })
}

export async function getStakingPoolClient(
  poolAppId: bigint,
  signer: algosdk.TransactionSigner,
  activeAddress: string,
): Promise<StakingPoolClient> {
  algorandClient.setSigner(activeAddress, signer)
  return algorandClient.client.getTypedAppClientById(StakingPoolClient, {
    defaultSender: activeAddress,
    appId: poolAppId,
  })
}

export async function getSimulateStakingPoolClient(
  poolAppId: bigint,
  senderAddr: string = FEE_SINK,
): Promise<StakingPoolClient> {
  return algorandClient.client.getTypedAppClientById(StakingPoolClient, {
    defaultSender: senderAddr,
    appId: poolAppId,
  })
}
