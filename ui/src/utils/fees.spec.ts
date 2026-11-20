import algosdk from 'algosdk'
import { requiredGroupFee, simulatedExtraFee } from '@/utils/fees'

type TxnResult = algosdk.modelsv2.PendingTransactionResponse

function simTxn(innerTxns?: TxnResult[]): TxnResult {
  return { innerTxns } as unknown as TxnResult
}

function group(groupUsage: number | undefined, ...txns: TxnResult[]) {
  return {
    groupUsage,
    txnResults: txns.map((txnResult) => ({ txnResult })),
  } as unknown as algosdk.modelsv2.SimulateTransactionGroupResult
}

describe('requiredGroupFee', () => {
  it('uses the group usage reported by algod', () => {
    const sim = group(4_000_000, simTxn(), simTxn(), simTxn([simTxn()]))
    expect(requiredGroupFee(sim)).toBe(4000n)
    expect(simulatedExtraFee(sim)).toBe(1000n)
  })

  it('prefers group usage over the transaction count', () => {
    const sim = group(9_000_000, simTxn(), simTxn(), simTxn())
    expect(requiredGroupFee(sim)).toBe(9000n)
    expect(simulatedExtraFee(sim)).toBe(6000n)
  })

  it('rounds fractional usage up once for the group', () => {
    const sim = group(3_500_001, simTxn(), simTxn(), simTxn())
    expect(requiredGroupFee(sim)).toBe(3501n)
    expect(simulatedExtraFee(sim)).toBe(501n)
  })

  it('throws when algod reports no group usage', () => {
    const sim = group(undefined, simTxn(), simTxn(), simTxn([simTxn()]))
    expect(() => requiredGroupFee(sim)).toThrow(/group usage/)
    expect(() => simulatedExtraFee(sim)).toThrow(/group usage/)
  })

  it('needs no extra fee when the group has no inner txns', () => {
    expect(simulatedExtraFee(group(3_000_000, simTxn(), simTxn(), simTxn()))).toBe(0n)
  })
})
