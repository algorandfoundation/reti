import algosdk from 'algosdk'

type SimulateGroupResult = algosdk.modelsv2.SimulateTransactionGroupResult
/** Scale of `groupUsage`: millionths of a min fee. */
const MICROS_PER_FEE_UNIT = 1_000_000n

export const MIN_TXN_FEE = 1000n

/**
 * Total fee, in microAlgo, a simulated group has to pay across its outer transactions (the
 * contracts send inner txns with fee 0, so the outer group pays for them).
 *
 * Uses algod's own figure, `groupUsage`, which covers every inner transaction at any depth as well
 * as size-priced transactions. algod reports it from 5.0.0 on; without it we throw rather than
 * guess a fee.
 *
 * Replaces the old `appBudgetAdded / 700` estimate, which go-algorand #6708 (5.1.0) broke: simulate
 * stopped counting payment-only inner groups as added budget, so the estimate came up one min fee
 * short per inner payment or asset transfer.
 */
export function requiredGroupFee(group: SimulateGroupResult, minFee = MIN_TXN_FEE): bigint {
  const usage = BigInt(group.groupUsage ?? 0)
  if (usage === 0n) {
    throw new Error(
      'algod did not report group usage for the simulated group; algod 5.0 or later is required',
    )
  }
  return (usage * minFee + MICROS_PER_FEE_UNIT - 1n) / MICROS_PER_FEE_UNIT
}

/**
 * What a simulated group still owes when every outer transaction pays its own min fee: the amount
 * to put as `extraFee` on one transaction of the real group.
 */
export function simulatedExtraFee(group: SimulateGroupResult, minFee = MIN_TXN_FEE): bigint {
  const paidByBaseFees = BigInt(group.txnResults.length) * minFee
  const required = requiredGroupFee(group, minFee)
  return required > paidByBaseFees ? required - paidByBaseFees : 0n
}
