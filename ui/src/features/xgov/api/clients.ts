import algosdk from 'algosdk'
import { FEE_SINK } from '@/constants/accounts'
import { getXGovRegistryAppIdFromViteEnvironment } from '@/utils/env'
// @ts-expect-error module resolution issue
import { XGovRegistryClient } from '@algorandfoundation/xgov-clients/registry'
import { algorandClient } from '@/api/clients'

const XGOV_REGISTRY_APP_ID = BigInt(getXGovRegistryAppIdFromViteEnvironment())

export async function getXGovRegistryClient(
  signer: algosdk.TransactionSigner,
  activeAddress: string,
): Promise<XGovRegistryClient> {
  algorandClient.setSigner(activeAddress, signer)
  return algorandClient.client.getTypedAppClientById(XGovRegistryClient, {
    defaultSender: activeAddress,
    appId: XGOV_REGISTRY_APP_ID,
  })
}

export async function getSimulateXGovRegistryClient(
  senderAddr: string = FEE_SINK,
): Promise<XGovRegistryClient> {
  return algorandClient.client.getTypedAppClientById(XGovRegistryClient, {
    defaultSender: senderAddr,
    appId: XGOV_REGISTRY_APP_ID,
  })
}
