import { RetiFastSDK } from 'reti-fast-sdk'
import { algorandClient, RETI_APP_ID } from './clients'

export const ghostSDK = new RetiFastSDK({
  algorand: algorandClient,
  registryAppId: RETI_APP_ID,
})

// disable params caching, out algorand client has paras cache already
ghostSDK.ghostSDK.cacheParamsTimeout = 0
