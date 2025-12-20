/**
 * Utility function to chunk an array into smaller arrays of a specified size.
 * @param array Array to be chunked
 * @param size Chunk size
 * @returns Array of chunked arrays
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const result: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size))
  }
  return result
}
