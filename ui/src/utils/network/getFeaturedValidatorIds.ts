export function getFeaturedValidatorIds(): number[] {
  if (!import.meta.env.VITE_RETI_FEATURED_VAL_IDS) {
    throw new Error(
      'Attempt to get featured validator IDs without specifying VITE_RETI_FEATURED_VAL_IDS in the environment variables',
    )
  }

  const ids: number[] = JSON.parse(import.meta.env.VITE_RETI_FEATURED_VAL_IDS)
  return ids
}

export function getRndValidatorNum(): number {
  if (!import.meta.env.VITE_RETI_FEATURED_RND_NUM) {
    throw new Error(
      'Attempt to get number of randomly selected featured validators without specifying VITE_RETI_FEATURED_RND_NUM in the environment variables',
    )
  }

  return Number(import.meta.env.VITE_RETI_FEATURED_RND_NUM)
}
