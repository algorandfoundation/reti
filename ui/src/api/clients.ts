import { FEE_SINK } from '@/constants/accounts'
import { StakingPoolClient, StakingPoolFactory } from '@/contracts/StakingPoolClient'
import { ValidatorRegistryClient } from '@/contracts/ValidatorRegistryClient'
import {
  getRetiAppIdFromViteEnvironment,
  getXGovRegistryAppIdFromViteEnvironment,
} from '@/utils/env'
import { getAlgodConfigFromViteEnvironment } from '@/utils/network/getAlgoClientConfigs'
import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import algosdk from 'algosdk'
// @ts-expect-error module resolution issue
import { XGovRegistryClient } from '@algorandfoundation/xgov-clients/registry'

const algodConfig = getAlgodConfigFromViteEnvironment()

export const algorandClient = AlgorandClient.fromConfig({ algodConfig })
  .setDefaultValidityWindow(900)
  .setSuggestedParamsCacheTimeout(1000 * 60 * 5) // 5 minutes

export const RETI_APP_ID = BigInt(getRetiAppIdFromViteEnvironment())
const XGOV_REGISTRY_APP_ID = BigInt(getXGovRegistryAppIdFromViteEnvironment())

export function getStakingPoolFactory(): [AlgorandClient, StakingPoolFactory] {
  return [algorandClient, new StakingPoolFactory({ algorand: algorandClient })]
}

export function getValidatorClient(
  signer: algosdk.TransactionSigner,
  activeAddress: string,
): ValidatorRegistryClient {
  algorandClient.setSigner(activeAddress, signer)
  return algorandClient.client.getTypedAppClientById(ValidatorRegistryClient, {
    defaultSender: activeAddress,
    appId: RETI_APP_ID,
  })
}

export function getSimulateValidatorClient(senderAddr: string = FEE_SINK): ValidatorRegistryClient {
  return algorandClient.client.getTypedAppClientById(ValidatorRegistryClient, {
    defaultSender: senderAddr,
    appId: RETI_APP_ID,
  })
}

export function getStakingPoolClient(
  poolAppId: bigint,
  signer: algosdk.TransactionSigner,
  activeAddress: string,
): StakingPoolClient {
  algorandClient.setSigner(activeAddress, signer)
  return algorandClient.client.getTypedAppClientById(StakingPoolClient, {
    defaultSender: activeAddress,
    appId: poolAppId,
  })
}

export function getSimulateStakingPoolClient(
  poolAppId: bigint,
  senderAddr: string = FEE_SINK,
): StakingPoolClient {
  return algorandClient.client.getTypedAppClientById(StakingPoolClient, {
    defaultSender: senderAddr,
    appId: poolAppId,
  })
}

export function getXGovRegistryClient(
  signer: algosdk.TransactionSigner,
  activeAddress: string,
): XGovRegistryClient {
  algorandClient.setSigner(activeAddress, signer)
  return algorandClient.client.getTypedAppClientById(XGovRegistryClient, {
    defaultSender: activeAddress,
    appId: XGOV_REGISTRY_APP_ID,
  })
}

export function getSimulateXGovRegistryClient(senderAddr: string = FEE_SINK): XGovRegistryClient {
  return algorandClient.client.getTypedAppClientById(XGovRegistryClient, {
    defaultSender: senderAddr,
    appId: XGOV_REGISTRY_APP_ID,
  })
}
