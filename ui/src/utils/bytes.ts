import algosdk from 'algosdk'

/**
 * Concatenates two Uint8Arrays into a single Uint8Array.
 * @param {Uint8Array} a - The first Uint8Array
 * @param {Uint8Array} b - The second Uint8Array
 * @returns {Uint8Array} The concatenated Uint8Array
 */
export function concatUint8Arrays(a: Uint8Array, b: Uint8Array): Uint8Array {
  const result = new Uint8Array(a.length + b.length)
  result.set(a)
  result.set(b, a.length)
  return result
}

/**
 * Encodes a BigInt value into an 8-byte big-endian format and pads it to
 * create a 32-byte long Uint8Array.
 * @param {bigint} value - The gating value to encode
 * @returns {Uint8Array} The encoded gating value
 * @example
 * gatingValueFromBigint(BigInt(123456789))
 * // Uint8Array [21, 205, 91, 7, 0, 0, 0, 0, 0, ...]
 */
export function gatingValueFromBigint(value: bigint): Uint8Array {
  return concatUint8Arrays(algosdk.encodeUint64(value), new Uint8Array(24))
}

/**
 * Decodes a Uint8Array back into a BigInt.
 * Assumes the Uint8Array was encoded in an 8-byte big-endian format,
 * followed by padding, similar to how `gatingValueFromBigint` encodes it.
 * @param {Uint8Array} data - The Uint8Array to decode, expected to be 32 bytes long
 * @returns {bigint} The decoded bigint value
 * @example
 * const value = BigInt(987654321)
 * const encodedValue = algosdk.encodeUint64(value)
 * const paddedValue = new Uint8Array([...encodedValue, ...new Uint8Array(24)])
 * decodeUint8ArrayToBigint(paddedValue) // 987654321n
 */
export function decodeUint8ArrayToBigint(data: Uint8Array): bigint {
  if (data.length < 8) {
    throw new Error('Data is too short to contain a valid encoded bigint.')
  }

  // Extract the first 8 bytes that contain the big-endian encoded bigint
  let result: bigint = BigInt(0)
  for (let i = 0; i < 8; i++) {
    // Shift the result left by 8 bits to make room for the next byte
    result = (result << BigInt(8)) + BigInt(data[i])
  }

  return result
}

/**
 * Builds the box name for a `BoxMap<uint64, ...>` entry: the map's ASCII prefix followed by
 * the key as a big-endian uint64.
 * @param {string} prefix - The BoxMap's key prefix, e.g. 'v' for `validatorList`
 * @param {number | bigint} id - The uint64 key
 * @returns {Uint8Array} The raw box name
 * @example
 * boxNameForId('v', 1) // Uint8Array [118, 0, 0, 0, 0, 0, 0, 0, 1]
 */
export function boxNameForId(prefix: string, id: number | bigint): Uint8Array {
  return concatUint8Arrays(new TextEncoder().encode(prefix), algosdk.encodeUint64(BigInt(id)))
}

/**
 * Decodes the uint64 key out of a `prefix + uint64` box name, or returns null if the name
 * isn't one. The length check matters: algod's `prefix` query is a prefix filter, not an exact
 * match, so a differently shaped box key sharing the prefix would otherwise decode as one.
 * @param {string} prefix - The BoxMap's key prefix the name is expected to carry
 * @param {Uint8Array} name - The raw box name
 * @returns {bigint | null} The decoded key, or null if the name doesn't match the prefix
 */
export function idFromBoxName(prefix: string, name: Uint8Array): bigint | null {
  const prefixBytes = new TextEncoder().encode(prefix)

  if (name.length !== prefixBytes.length + 8) {
    return null
  }
  for (let i = 0; i < prefixBytes.length; i++) {
    if (name[i] !== prefixBytes[i]) {
      return null
    }
  }

  return algosdk.decodeUint64(name.subarray(prefixBytes.length), 'bigint')
}

/**
 * Splits a Uint8Array into chunks of a given size.
 * @param {Uint8Array} data - The Uint8Array to split into chunks
 * @param {number} chunkSize - The size of each chunk (default: 64 [bytes])
 * @returns {Uint8Array[]} An array of Uint8Array chunks
 * @example
 * const data = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
 * chunkBytes(data, 4)
 * // [
 * //   Uint8Array [1, 2, 3, 4],
 * //   Uint8Array [5, 6, 7, 8],
 * //   Uint8Array [9, 10],
 * // ]
 */
export function chunkBytes(data: Uint8Array, chunkSize: number = 64): Uint8Array[] {
  const chunks: Uint8Array[] = []
  for (let i = 0; i < data.length; i += chunkSize) {
    chunks.push(data.slice(i, i + chunkSize))
  }
  return chunks
}
