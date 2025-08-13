export function getRetiAppIdFromViteEnvironment(): number {
  if (!import.meta.env.VITE_RETI_APP_ID) {
    throw new Error(
      'Attempt to get Reti master validator app id without specifying VITE_RETI_APP_ID in the environment variables',
    )
  }

  return Number(import.meta.env.VITE_RETI_APP_ID)
}

export function getXGovRegistryAppIdFromViteEnvironment(): number {
    if (!import.meta.env.VITE_XGOV_REGISTRY_APP_ID) {
    throw new Error(
      'Attempt to get xGov Registry app id without specifying VITE_XGOV_REGISTRY_APP_ID in the environment variables',
    )
  }

  return Number(import.meta.env.VITE_XGOV_REGISTRY_APP_ID)
}