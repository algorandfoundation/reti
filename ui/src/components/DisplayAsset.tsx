import algosdk from 'algosdk'
import * as React from 'react'
import { ExplorerLink } from '@/utils/explorer'
import { cn } from '@/utils/ui'

interface DisplayAssetProps {
  asset?: algosdk.modelsv2.Asset
  show?: 'name' | 'unit-name' | 'full'
  link?: boolean
  fallback?: React.ReactNode
  className?: string
}

export function DisplayAsset({
  asset,
  show = 'unit-name',
  link = false,
  fallback = <span className="text-muted-foreground">--</span>,
  className = '',
}: DisplayAssetProps) {
  const renderUnitName = (unitName: string) => {
    return <span className="font-mono">{unitName}</span>
  }

  const renderDisplayAsset = (asset: algosdk.modelsv2.Asset) => {
    const { name, unitName } = asset.params

    if (unitName && show === 'unit-name') {
      return renderUnitName(unitName)
    }

    if (name && show === 'name') {
      return name
    }

    if (show === 'full') {
      if (name && unitName) {
        return (
          <>
            {name} ({renderUnitName(unitName)})
          </>
        )
      } else if (name) {
        return name
      } else if (unitName) {
        return renderUnitName(unitName)
      }
    }

    if (unitName) {
      return renderUnitName(unitName)
    }

    return asset.index.toString()
  }

  if (!asset) {
    return fallback
  }

  if (link) {
    return (
      <a
        href={ExplorerLink.asset(asset.index)}
        rel="noreferrer"
        target="_blank"
        className={cn('link text-foreground', className)}
      >
        {renderDisplayAsset(asset)}
      </a>
    )
  }

  return <span className={className}>{renderDisplayAsset(asset)}</span>
}
