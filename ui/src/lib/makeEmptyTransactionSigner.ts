import algosdk from 'algosdk'

/**
 * This is a "polyfill" for algosdk's `makeEmptyTransactionSigner` function that supports simulate
 * calls from rekeyed accounts.
 * @see https://github.com/algorand/go-algorand/issues/5914
 *
 * @param {string} authAddr - Optional authorized address (spending key) for a rekeyed account.
 * @returns A function that can be used with simulate w/ the "allow empty signatures" option.
 */
export const makeEmptyTransactionSigner = (authAddr?: string): algosdk.TransactionSigner => {
  return async (txns: algosdk.Transaction[], indexesToSign: number[]): Promise<Uint8Array[]> => {
    const emptySigTxns: Uint8Array[] = []

    indexesToSign.forEach((i) => {
      const txn = txns[i]
      const encodedStxn: Map<string, unknown> = new Map([['txn', txn.toEncodingData()]])

      // If authAddr is provided, use its decoded publicKey as the signer
      if (authAddr) {
        encodedStxn.set('sgnr', algosdk.decodeAddress(authAddr).publicKey)
      }

      emptySigTxns.push(algosdk.msgpackRawEncode(encodedStxn))
    })

    return emptySigTxns
  }
}
