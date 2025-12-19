import { RetiGhostSDK } from 'reti-ghost-sdk'
import { algorandClient, RETI_APP_ID } from './clients'

export const ghostSDK = new RetiGhostSDK({
  algorand: algorandClient,
  registryAppId: RETI_APP_ID,
})

// disable params caching, our algorand client has params cache already
ghostSDK.baseSDK.cacheParamsTimeout = 0
