export type Asset = {
  index: bigint
  params: {
    creator: string
    total: bigint
    decimals: number
    unitName?: string
    name?: string
  }
}
