import { AlgoAmount } from '@algorandfoundation/algokit-utils/types/amount'
import { ClientManager } from '@algorandfoundation/algokit-utils/types/client-manager'
import algosdk from 'algosdk'
import { AccountBalance, AlgodHttpError, AssetCreatorHolding, Exclude } from '@/interfaces/algod'
import { BigMath } from '@/utils/bigint'
import { getAlgodConfigFromViteEnvironment } from '@/utils/network/getAlgoClientConfigs'

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

export async function fetchAsset(assetId: bigint | number): Promise<algosdk.modelsv2.Asset> {
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

export async function fetchApplication(appId: bigint): Promise<algosdk.modelsv2.Application> {
  try {
    return await algodClient.getApplicationByID(appId).do()
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

export async function fetchAssetHoldings(
  address: string | null,
): Promise<algosdk.modelsv2.AssetHolding[]> {
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
        // algosdk 3.6 types params as optional; an empty creator simply matches no address
        creator: asset.params?.creator ?? '',
      }
    })
    allAssetCreatorHoldings.push(...assetCreatorHoldings)
  }

  return allAssetCreatorHoldings
}

export interface AppBox {
  name: Uint8Array
  value: Uint8Array
}

export interface FetchAppBoxesOptions {
  /**
   * Prefix to filter box names by, as a BoxMap key prefix string or raw bytes. algosdk
   * base64-encodes it for the wire.
   */
  prefix?: string | Uint8Array
  /** Boxes per page. The node caps a response well below this on large apps. */
  pageSize?: number
  /** Circuit breaker so a bad `next-token` can't loop forever. */
  maxPages?: number
}

/**
 * Thrown when algod returns box descriptors without values despite `include=values`,
 * which means the node (or a proxy in front of it) dropped the parameter. Failing loudly
 * beats silently rendering an app's state as empty.
 */
export class BoxValuesUnsupportedError extends Error {
  constructor(appId: bigint) {
    super(
      `algod returned box names without values for app ${appId}. The node may predate ` +
        `the 'include=values' parameter, or a proxy is stripping it.`,
    )
    this.name = 'BoxValuesUnsupportedError'
  }
}

/** Warn if a single page gets large enough to be worth revisiting the polling cadence. */
const BOX_PAGE_SIZE_WARN_BYTES = 2_000_000

/**
 * Fetches all boxes for an app - names *and* values - in as few requests as possible.
 *
 * Requires algosdk >= 3.6, which added `include('values')` alongside cursor pagination.
 * Before that, reading N boxes meant 1 request to list the names plus N more for the values.
 *
 * All pages after the first are pinned to the round returned by the first, so a multi-page
 * read is a consistent snapshot rather than a smear across rounds.
 */
export async function fetchAppBoxes(
  appId: bigint,
  options: FetchAppBoxesOptions = {},
): Promise<{ boxes: AppBox[]; round?: number }> {
  const { prefix, pageSize = 1000, maxPages = 50 } = options
  const prefixBytes = typeof prefix === 'string' ? new TextEncoder().encode(prefix) : prefix

  const boxes: AppBox[] = []
  let nextToken: string | undefined
  let pinnedRound: number | undefined
  let pages = 0

  do {
    if (++pages > maxPages) {
      // Return what we have rather than throwing it away - a partial validator list still
      // renders, and the caller is told the read was cut short.
      console.warn(
        `fetchAppBoxes(${appId}) stopped at the ${maxPages} page limit with ${boxes.length} boxes; ` +
          `results are incomplete.`,
      )
      break
    }

    let request = algodClient.getApplicationBoxes(appId).include('values').limit(pageSize)

    if (prefixBytes !== undefined && prefixBytes.length > 0) {
      request = request.prefix(prefixBytes)
    }
    if (nextToken !== undefined) {
      request = request.next(nextToken)
    }
    if (pinnedRound !== undefined) {
      request = request.round(pinnedRound)
    }

    const response = await request.do()

    if (pinnedRound === undefined) {
      pinnedRound = response.round
    }

    for (const box of response.boxes) {
      if (box.value === undefined) {
        throw new BoxValuesUnsupportedError(appId)
      }
      boxes.push({ name: box.name, value: box.value })
    }

    // Stop on an empty page or a token that didn't advance, so a misbehaving node
    // can't spin us until maxPages.
    if (response.boxes.length === 0 || response.nextToken === nextToken) {
      break
    }

    nextToken = response.nextToken || undefined
  } while (nextToken)

  // `round` is optional in algod's response. Without it later pages went unpinned, so a write
  // between pages could have been read inconsistently - say so rather than claiming a snapshot.
  if (pages > 1 && pinnedRound === undefined) {
    console.warn(
      `fetchAppBoxes(${appId}) paged over ${pages} requests without a round to pin them to; ` +
        `the result may span rounds.`,
    )
  }

  const totalBytes = boxes.reduce((sum, box) => sum + box.value.length, 0)
  if (totalBytes > BOX_PAGE_SIZE_WARN_BYTES) {
    console.warn(
      `fetchAppBoxes(${appId}) returned ${boxes.length} boxes / ${totalBytes} bytes. ` +
        `Consider reducing the polling cadence for this app.`,
    )
  }

  return { boxes, round: pinnedRound }
}

/**
 * Fetches a single box value by name.
 */
export async function fetchAppBoxValue(appId: bigint, name: Uint8Array): Promise<Uint8Array> {
  try {
    const response = await algodClient.getApplicationBoxByName(appId, name).do()
    return response.value
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    if (error.message && error.response) {
      throw new AlgodHttpError(error.message, error.response)
    }
    throw error
  }
}

/**
 * Fetches timestamps for the last `numRounds` blocks
 * @param {number} numRounds - The number of rounds to fetch
 * @return {number[]} - An array of timestamps for each block
 */
export async function fetchBlockTimes(numRounds: number = 10): Promise<number[]> {
  try {
    const status = await algodClient.status().do()
    if (!status) {
      throw new Error('Failed to fetch node status')
    }

    const lastRound = Number(status.lastRound)

    const blockTimes: number[] = []
    for (let round = lastRound - numRounds; round < lastRound; round++) {
      try {
        const blockResponse = await algodClient.block(round).do()
        const block = blockResponse.block
        blockTimes.push(Number(block.header.timestamp))
      } catch (error) {
        throw new Error(`Unable to fetch block for round ${round}: ${error}`)
      }
    }

    return blockTimes
  } catch (error) {
    throw new Error(`An error occurred during block time calculation: ${error}`)
  }
}
