import * as React from 'react'
import { toast } from 'sonner'

// Helper function to compare versions
function isNewerVersion(current: string, deployed: string): boolean {
  // Remove 'v' prefix if present
  const cleanCurrent = current.replace(/^v/, '')
  const cleanDeployed = deployed.replace(/^v/, '')

  const currentParts = cleanCurrent.split('.').map(Number)
  const deployedParts = cleanDeployed.split('.').map(Number)

  // Compare major.minor.patch
  for (let i = 0; i < 3; i++) {
    if (deployedParts[i] > currentParts[i]) return true
    if (deployedParts[i] < currentParts[i]) return false
  }

  return false
}

export function useCheckForUpdates() {
  React.useEffect(() => {
    if (import.meta.env.MODE !== 'production') {
      return
    }

    const checkForUpdates = async () => {
      try {
        const response = await fetch(`/version.json?_=${Date.now()}`, {
          cache: 'no-cache',
          headers: {
            'Cache-Control': 'no-cache',
            Pragma: 'no-cache',
            'If-None-Match': '*',
            'If-Modified-Since': '0',
          },
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const data = await response.json()
        const deployedVersion = data.version

        // Only show toast if deployed version is newer
        if (isNewerVersion(__APP_VERSION__, deployedVersion)) {
          // eslint-disable-next-line no-console
          console.log('New version detected:', {
            current: __APP_VERSION__,
            deployed: deployedVersion,
            timestamp: new Date().toISOString(),
          })

          toast(`A new version is available! v${deployedVersion}`, {
            description: 'Click the Reload button to update the app.',
            action: {
              label: 'Reload',
              onClick: () => window.location.reload(),
            },
            id: 'new-version',
            duration: Infinity,
          })
        }
      } catch (error) {
        console.error('Failed to check for updates:', error)
      }
    }

    checkForUpdates()

    const delay = Number(import.meta.env.VITE_UPDATE_CHECK_INTERVAL || 1000 * 60)
    if (Number.isNaN(delay)) {
      console.error('Invalid update check interval:', import.meta.env.VITE_UPDATE_CHECK_INTERVAL)
      return
    }

    const interval = setInterval(checkForUpdates, delay)
    return () => clearInterval(interval)
  }, [])
}
