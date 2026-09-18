import { getABIDecodedValue } from '@algorandfoundation/algokit-utils/types/app-arc56'
import { fetchAppBoxes } from '@/api/algod'
import { boxNameForId, idFromBoxName } from '@/utils/bytes'
import { XGOV_REGISTRY_APP_ID, getSimulateXGovRegistryClient } from './clients'
import {
  APP_SPEC as XGOV_APP_SPEC,
  GlobalKeysState,
  XGovBoxValue,
  XGovSubscribeRequestBoxValue,
  // @ts-expect-error module resolution issue
} from '@algorandfoundation/xgov-clients/registry'

/** Box name prefix for the registry's `request_box` BoxMap */
const REQUEST_BOX_PREFIX = 'r'

export function requestBoxName(id: number): Uint8Array {
  return boxNameForId(REQUEST_BOX_PREFIX, id)
}

export async function getXGovGlobalState(): Promise<GlobalKeysState | undefined> {
  try {
    const client = await getSimulateXGovRegistryClient()
    return (await client.state.global.getAll()) as unknown as GlobalKeysState
  } catch (e) {
    console.error('failed to fetch global registry contract state', e)
    return {} as GlobalKeysState
  }
}

export async function getXGovBoxes(
  xgovAddresses: string[],
): Promise<{ [address: string]: XGovBoxValue }> {
  const client = await getSimulateXGovRegistryClient()
  const results = await Promise.allSettled(
    xgovAddresses.map(async (address) => {
      const box = await client.state.box.xgovBox.value(address)
      return { address, box }
    }),
  )

  const boxes: { [address: string]: XGovBoxValue } = {}
  results.forEach((result) => {
    if (result.status === 'fulfilled') {
      const { address, box } = result.value
      if (box) {
        boxes[address] = box
      }
    }
  })

  return boxes
}

export async function getXGovRequestBoxes(
  ownerAddress: string | null,
  xgovAddresses: string[],
): Promise<{ [id: number]: XGovSubscribeRequestBoxValue } | null> {
  try {
    // Reads names and values together. The typed client's `requestBox.getMap()` issues one
    // HTTP request per box, which scales with the whole registry rather than this user.
    const { boxes } = await fetchAppBoxes(XGOV_REGISTRY_APP_ID, { prefix: REQUEST_BOX_PREFIX })

    const requestBoxes: { [id: number]: XGovSubscribeRequestBoxValue } = {}
    for (const box of boxes) {
      const id = idFromBoxName(REQUEST_BOX_PREFIX, box.name)
      if (id === null) {
        continue
      }

      const value = getABIDecodedValue(
        box.value,
        'XGovSubscribeRequestBoxValue',
        XGOV_APP_SPEC.structs,
      ) as XGovSubscribeRequestBoxValue

      if (
        value.ownerAddr === ownerAddress &&
        xgovAddresses.includes(value.xgovAddr) &&
        value.relationType === 1n // Reti enum value for relation type
      ) {
        requestBoxes[Number(id)] = value
      }
    }

    return requestBoxes
  } catch (e) {
    console.error('failed to fetch request box by address', e)
    return null
  }
}
