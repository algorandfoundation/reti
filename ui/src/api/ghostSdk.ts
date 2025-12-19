import { RetiGhostSDK } from 'reti-ghost-sdk'
import { algorandClient, RETI_APP_ID } from './clients'

export const ghostSDK = new RetiGhostSDK({
  algorand: algorandClient,
  registryAppId: RETI_APP_ID,
})

// disable params caching, out algorand client has paras cache already
ghostSDK.ghostSDK.cacheParamsTimeout = 0
