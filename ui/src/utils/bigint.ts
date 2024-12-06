/**
 * Utility object that provides mathematical operations for bigint values,
 * mimicking the behavior of the native Math object.
 *
 * This provides equivalent functionality to Math.min(), Math.max(), and Math.abs()
 * but operates on bigint values instead of numbers.
 *
 * @example
 * BigMath.min(5n, 3n, 7n) // returns 3n
 * BigMath.max(5n, 3n, 7n) // returns 7n
 * BigMath.abs(-5n) // returns 5n
 */
export const BigMath = {
  /**
   * Returns the smaller of two or more bigint values
   */
  min: (...values: bigint[]): bigint => {
    if (values.length === 0) {
      throw new Error('Cannot find minimum of empty array')
    }
    return values.reduce((min, val) => (val < min ? val : min))
  },

  /**
   * Returns the larger of two or more bigint values
   */
  max: (...values: bigint[]): bigint => {
    if (values.length === 0) {
      throw new Error('Cannot find maximum of empty array')
    }
    return values.reduce((max, val) => (val > max ? val : max))
  },

  /**
   * Returns the absolute value of a bigint
   */
  abs: (value: bigint): bigint => {
    return value < 0n ? -value : value
  },
}
