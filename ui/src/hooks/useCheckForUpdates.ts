import * as React from 'react'
import { toast } from 'sonner'

export function useCheckForUpdates() {
  React.useEffect(() => {
    if (import.meta.env.MODE !== 'production') {
      return
    }

    const checkForUpdates = async () => {
      try {
        const response = await fetch(`/version.json?_=${Date.now()}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            Pragma: 'no-cache',
            Expires: '0',
          },
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const data = await response.json()
        const deployedVersion = data.version

        if (deployedVersion !== __APP_VERSION__) {
          // eslint-disable-next-line no-console
          console.log('Version mismatch detected:', {
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
