export const FUNDING_CATEGORY = {
  NULL: 0n, // Null category
  SMALL: 10n, // Small category
  MEDIUM: 20n, // Medium category
  LARGE: 33n, // Large category
} as const

export type FundingCategory = (typeof FUNDING_CATEGORY)[keyof typeof FUNDING_CATEGORY]

const FUNDING_CATEGORY_VALUES = Object.values(FUNDING_CATEGORY) as readonly FundingCategory[]

export function isFundingCategory(x: unknown): boolean {
  return typeof x === 'bigint' && FUNDING_CATEGORY_VALUES.includes(x as FundingCategory)
}

export const FUNDING_CATEGORY_LABELS = new Map<FundingCategory, keyof typeof FUNDING_CATEGORY>(
  Object.entries(FUNDING_CATEGORY).map(([k, v]) => [
    v as FundingCategory,
    k as keyof typeof FUNDING_CATEGORY,
  ]),
)

export function fundingCategoryLabel(cat: FundingCategory) {
  return FUNDING_CATEGORY_LABELS.get(cat)!
}
