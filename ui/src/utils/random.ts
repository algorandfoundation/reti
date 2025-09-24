export function getRandomUniqueIntegers(N: number, M: number): number[] {
  if (N > M) throw new Error('N cannot be greater than M')

  const result = new Set<number>()

  while (result.size < N) {
    const num = Math.floor(Math.random() * M) + 1
    result.add(num)
  }

  return Array.from(result)
}
