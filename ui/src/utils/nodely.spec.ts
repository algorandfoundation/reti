import { NodelyRetiPerfData } from '@/interfaces/nodely'
import { findValidatorPerf } from '@/utils/nodely'

function perfRow(overrides: Partial<NodelyRetiPerfData>): NodelyRetiPerfData {
  return {
    validatorid: 1,
    poolid: 1,
    poolappid: 3094048303,
    poolappaddr: 'CRTAUOE76O76I3WDS4FKYRWYSMBPMV4TRG4O5PZWIY7ZHIGQROREQY6F6Y',
    rspan: 31000,
    rounds: 31000,
    avgfp: 3.44,
    votes: 30998,
    expSoftVotes: 31000,
    perf: 1,
    fOnline: 1,
    lastSVRnd: 64254000,
    ...overrides,
  }
}

describe('findValidatorPerf', () => {
  it('matches the numeric validatorid the API actually returns', () => {
    const rows = [
      perfRow({ validatorid: 147, perf: 0.99 }),
      perfRow({ validatorid: 137, perf: 0.42 }),
    ]

    expect(findValidatorPerf(rows, 147)).toBe(0.99)
    expect(findValidatorPerf(rows, 137)).toBe(0.42)
  })

  it('still matches when validatorid comes back as a quoted string', () => {
    // Nodely has serialized its uint64 columns both ways; neither shape may silently miss.
    const rows = [perfRow({ validatorid: '147' as unknown as number, perf: 0.99 })]

    expect(findValidatorPerf(rows, 147)).toBe(0.99)
  })

  it('accepts a bigint validator id', () => {
    const rows = [perfRow({ validatorid: 147, perf: 0.99 })]

    expect(findValidatorPerf(rows, 147n)).toBe(0.99)
  })

  it('returns the first pool row for a multi-pool validator', () => {
    const rows = [
      perfRow({ validatorid: 9, poolid: 1, perf: 0.95 }),
      perfRow({ validatorid: 9, poolid: 2, perf: 0.12 }),
    ]

    expect(findValidatorPerf(rows, 9)).toBe(0.95)
  })

  it('returns undefined when the validator has no row', () => {
    expect(findValidatorPerf([perfRow({ validatorid: 147 })], 148)).toBeUndefined()
  })

  it('returns undefined for missing or empty data', () => {
    expect(findValidatorPerf(undefined, 147)).toBeUndefined()
    expect(findValidatorPerf([], 147)).toBeUndefined()
  })

  it('preserves a genuine zero score rather than reporting no data', () => {
    const rows = [perfRow({ validatorid: 147, perf: 0 })]

    expect(findValidatorPerf(rows, 147)).toBe(0)
  })
})
