import { NodePoolAssignmentConfig } from '@/contracts/ValidatorRegistryClient'

export function getPoolIndexFromName<T extends boolean>(
  name: number | string,
  asString?: T,
): T extends true ? string : number {
  const index = Number(String(name).split('Pool ')[1]) - 1
  return (asString ? String(index) : index) as T extends true ? string : number
}

export function getPoolNameFromIndex(index: number | string): string {
  return `Pool ${Number(index) + 1}`
}

export function nodeNumForPoolId(poolAppId: bigint, poolAssignments: NodePoolAssignmentConfig) {
  for (let nodeIndex = 0; nodeIndex < poolAssignments.nodes.length; nodeIndex++) {
    for (let poolIndex = 0; poolIndex < poolAssignments.nodes[nodeIndex][0].length; poolIndex++) {
      if (poolAssignments.nodes[nodeIndex][0][poolIndex] === poolAppId) {
        return nodeIndex + 1
      }
    }
  }
  return undefined
}
