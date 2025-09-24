import { wrapTransactionSigner } from '@/hooks/useTransactionState'
import { sleep } from '@/utils/time'
import { encodeUint64 } from 'algosdk'
import {
  GlobalKeysState,
  XGovBoxValue,
  XGovSubscribeRequestBoxValue,
  // @ts-expect-error module resolution issue
} from '@algorandfoundation/xgov-clients/registry'
import { TransactionHandlerProps } from '@/api/transactionState'
import { getSimulateXGovRegistryClient, getXGovRegistryClient } from './clients'

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

export interface RequestSubscribeXGovProps extends TransactionHandlerProps {
  xgovFee?: bigint
  pools: string[]
}

export async function requestSubscribeXGov({
  activeAddress,
  innerSigner,
  setStatus,
  refetch,
  xgovFee,
  pools,
}: RequestSubscribeXGovProps) {
  if (!innerSigner) return

  const signer = wrapTransactionSigner(innerSigner, setStatus)

  if (!activeAddress || !signer) {
    setStatus(new Error('No active address or transaction signer'))
    return
  }

  if (!xgovFee) {
    setStatus(new Error('xgovFee is not set'))
    return
  }

  const client = await getXGovRegistryClient(signer, activeAddress)

  const builder = client.newGroup()

  for (const pool of pools) {
    const payment = await client.algorand.createTransaction.payment({
      sender: activeAddress,
      receiver: client.appAddress,
      amount: xgovFee.microAlgo(),
      note: `payment for enrolling ${pool} in xGov`,
    })

    builder.requestSubscribeXgov({
      args: {
        xgovAddress: pool,
        ownerAddress: activeAddress,
        relationType: 1,
        payment,
      },
    })
  }

  try {
    const {
      confirmations: [confirmation],
    } = await builder.send({ populateAppCallResources: true })

    if (
      confirmation.confirmedRound !== undefined &&
      confirmation.confirmedRound > 0 &&
      confirmation.poolError === ''
    ) {
      setStatus('confirmed')
      await sleep(800)
      setStatus('idle')
      await Promise.all(refetch.map((r) => r()))
      return
    }

    setStatus(new Error('Failed to confirm transaction submission'))
  } catch (e) {
    console.error('Error during requestSubscribeXGov:', (e as Error).message)
    setStatus(new Error(`Failed to request subscription to xGov`))
    return
  }
}
