import { encodeUint64 } from 'algosdk'
import { getSimulateXGovRegistryClient } from './clients'
// @ts-expect-error module resolution issue
import { GlobalKeysState, XGovBoxValue, XGovSubscribeRequestBoxValue } from '@algorandfoundation/xgov/registry'

export function requestBoxName(id: number): Uint8Array {
  return new Uint8Array(Buffer.concat([Buffer.from('r'), encodeUint64(id)]))
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
    const client = await getSimulateXGovRegistryClient()
    const requests = await client.state.box.requestBox.getMap()

    const requestBoxes: { [id: number]: XGovSubscribeRequestBoxValue } = {}
    for (const [key, value] of requests) {
      if (
        value.ownerAddr === ownerAddress &&
        xgovAddresses.includes(value.xgovAddr) &&
        value.relationType === 1n // Reti enum value for relation type
      ) {
        requestBoxes[Number(key)] = value
      }
    }

    return requestBoxes
  } catch (e) {
    console.error('failed to fetch request box by address', e)
    return null
  }
}
