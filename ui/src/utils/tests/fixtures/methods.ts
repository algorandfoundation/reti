// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FixtureFunction = (args: any) => any[]

/**
 * Map containing each ABI method's mock response.
 *
 * Empty since validator config/state/pools/nodePoolAssignments moved from simulate calls to
 * a single box read - see `boxFixtures` in ./boxes.ts. Add an entry here (plus a matching
 * `encodeCallParams` note on the call) to mock a readonly ABI method.
 */
export const methodFixtures: Record<string, FixtureFunction> = {}
