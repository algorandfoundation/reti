import { FilterFn } from '@tanstack/react-table'
import { Validator } from '@/interfaces/validator'
import { isSunsetted } from '@/utils/contracts'

// Minimum staking amount for eligible validators (30,000 ALGO in microALGOs)
export const MIN_ELIGIBLE_STAKE = 30000n * 1000000n

export const globalFilterFn: FilterFn<Validator> = (row, columnId, filterValue) => {
  if (filterValue === '') return true

  const validator = row.original
  const search = filterValue.toLowerCase()

  const nfd = validator.nfd
  const name = nfd?.name?.toLowerCase() ?? ''
  const owner = validator.config.owner.toLowerCase()

  if (name.includes(search)) return true
  if (owner.includes(search)) return true

  const rewardToken = validator.rewardToken
  if (rewardToken) {
    const tokenId = rewardToken.index.toString()
    const { name, unitName } = rewardToken.params
    const tokenName = name?.toLowerCase() ?? ''
    const tokenUnitName = unitName?.toLowerCase() ?? ''

    if (tokenId === search) return true
    if (tokenName.includes(search)) return true
    if (tokenUnitName.includes(search)) return true
  }

  const gatingAssets = validator.gatingAssets
  if (gatingAssets) {
    const assetIds = gatingAssets.map((asset) => asset.index.toString())
    const assetNames = gatingAssets.map((asset) => asset.params.name?.toLowerCase() ?? '')
    const assetUnitnames = gatingAssets.map((asset) => asset.params.unitName?.toLowerCase() ?? '')

    if (assetIds.some((id) => id === search)) return true
    if (assetNames.some((name) => name.includes(search))) return true
    if (assetUnitnames.some((unitName) => unitName.includes(search))) return true
  }

  return false
}

export const sunsetFilter: FilterFn<Validator> = (row, columnId, showSunsetted) => {
  const validator = row.original
  const isSunset = isSunsetted(validator)
  return showSunsetted ? true : !isSunset
}

export const ineligibleFilter: FilterFn<Validator> = (row, columnId, showIneligible) => {
  const validator = row.original
  const isIneligible = validator.state.totalAlgoStaked < MIN_ELIGIBLE_STAKE
  return showIneligible ? true : !isIneligible
}
