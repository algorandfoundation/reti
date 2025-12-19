import { AccountBalance, AlgodHttpError, AssetCreatorHolding, Exclude } from '@/interfaces/algod'
import { Asset } from '@/interfaces/asset'
import { BigMath } from '@/utils/bigint'
import { getAlgodConfigFromViteEnvironment } from '@/utils/network/getAlgoClientConfigs'
import { AlgoAmount } from '@algorandfoundation/algokit-utils/types/amount'
import { ClientManager } from '@algorandfoundation/algokit-utils/types/client-manager'
import algosdk, { modelsv2 } from 'algosdk'
import { ghostSDK } from './ghostSdk'

const algodConfig = getAlgodConfigFromViteEnvironment()
const algodClient = ClientManager.getAlgodClient({
  server: algodConfig.server,
  port: algodConfig.port,
  token: algodConfig.token,
})

export async function fetchAccountInformation(
  address: string,
  exclude: Exclude = 'none',
): Promise<algosdk.modelsv2.Account> {
  const accountInfo = await algodClient.accountInformation(address).exclude(exclude).do()
  return accountInfo
}

export async function fetchAccountBalance(
  address: string,
  availableBalance = false,
): Promise<bigint> {
  const accountInfo = await fetchAccountInformation(address, 'all')

  return availableBalance ? accountInfo.amount - accountInfo.minBalance : accountInfo.amount
}

export async function fetchAsset(assetId: bigint | number): Promise<Asset> {
  try {
    const asset = await algodClient.getAssetByID(assetId).do()
    return asset
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    if (error.message && error.response) {
      throw new AlgodHttpError(error.message, error.response)
    } else {
      throw error
    }
  }
}

export async function fetchAssets(assetIds: bigint[] | number[]): Promise<Asset[]> {
  try {
    const assets = await ghostSDK.getAssets(assetIds)
    const deleted = assets.filter((asset) => 'deleted' in asset && asset.deleted)
    if (deleted.length > 0) {
      throw new Error(
        `One or more assets have been deleted: ${deleted.map((a) => a.index).join(', ')}`,
      )
    }
    return assets as Asset[]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    if (error.message && error.response) {
      throw new AlgodHttpError(error.message, error.response)
    } else {
      throw error
    }
  }
}

export async function fetchBalance(address: string | null): Promise<AccountBalance> {
  if (!address) {
    throw new Error('No address provided')
  }
  const accountInfo = await fetchAccountInformation(address, 'all')

  const amount = accountInfo.amount
  const minimum = accountInfo.minBalance
  const available = BigMath.max(0n, amount - minimum)

  return {
    amount: AlgoAmount.MicroAlgos(amount),
    available: AlgoAmount.MicroAlgos(available),
    minimum: AlgoAmount.MicroAlgos(minimum),
  }
}

export async function fetchAssetHoldings(address: string | null): Promise<modelsv2.AssetHolding[]> {
  if (!address) {
    throw new Error('No address provided')
  }
  const accountInfo = await fetchAccountInformation(address)
  const assets = accountInfo.assets || []
  return assets
}

export async function fetchAccountAssetInformation(
  address: string | null,
  assetId: bigint,
): Promise<algosdk.modelsv2.AccountAssetResponse> {
  if (!address) {
    throw new Error('No address provided')
  }
  if (!assetId) {
    throw new Error('No assetId provided')
  }
  try {
    const accountAssetInfo = await algodClient.accountAssetInformation(address, assetId).do()
    return accountAssetInfo
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    if (error.message && error.response) {
      throw new AlgodHttpError(error.message, error.response)
    } else {
      throw error
    }
  }
}

export async function isOptedInToAsset(address: string | null, assetId: bigint): Promise<boolean> {
  try {
    await fetchAccountAssetInformation(address, assetId)
    return true
  } catch (error: unknown) {
    if (error instanceof AlgodHttpError && error.response.status === 404) {
      return false
    } else {
      throw error
    }
  }
}

export async function fetchAssetCreatorHoldings(
  address: string | null,
): Promise<AssetCreatorHolding[]> {
  if (!address) {
    throw new Error('No address provided')
  }
  const assetHoldings = await fetchAssetHoldings(address)

  const chunkArray = <T>(arr: T[], chunkSize: number): T[][] => {
    const chunks: T[][] = []
    for (let i = 0; i < arr.length; i += chunkSize) {
      chunks.push(arr.slice(i, i + chunkSize))
    }
    return chunks
  }

  const allAssetCreatorHoldings: AssetCreatorHolding[] = []
  const batchSize = 10

  // Split the assetHoldings into batches of 10
  const batches = chunkArray(assetHoldings, batchSize)

  for (const batch of batches) {
    const promises = batch.map((holding) => fetchAsset(holding.assetId))
    const assets = await Promise.all(promises)
    const assetCreatorHoldings = assets.map((asset, index) => {
      return {
        ...batch[index],
        creator: asset.params.creator,
      }
    })
    allAssetCreatorHoldings.push(...assetCreatorHoldings)
  }

  return allAssetCreatorHoldings
}

/**
 * Fetches timestamps for the last `numRounds` blocks
 * @param {number} numRounds - The number of rounds to fetch
 * @return {number[]} - An array of timestamps for each block
 */
export async function fetchBlockTimes(numRounds: number = 10): Promise<number[]> {
  try {
    return (await ghostSDK.getBlockTimestamps(numRounds)).map((b) => Number(b))
  } catch (error) {
    throw new Error(`An error occurred during block time calculation: ${error}`)
  }
}
