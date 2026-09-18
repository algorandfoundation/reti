import algosdk from 'algosdk'

export const CURRENT_TIME_MS = 1715144999000
export const AVG_BLOCK_TIME_SECS = 2.8
export const AVG_BLOCK_TIME_MS = AVG_BLOCK_TIME_SECS * 1000
export const LAST_ROUND = 10
export const RETURN_PREFIX = Buffer.from([21, 31, 124, 117])

/** Matches VITE_RETI_APP_ID in .env.test. Hardcoded to keep fixtures free of client setup. */
export const RETI_APP_ID = 1002n

/** Creator of every staking pool app, and so the account their global state is read from. */
export const RETI_APP_ADDRESS = algosdk.getApplicationAddress(RETI_APP_ID).toString()

export const MOCK_ACCOUNT_MICROALGOS = 40_000_000_000
export const MOCK_ACCOUNT_MIN_BALANCE = 100_000
export const MOCK_POOL_APY = 4.2
export const MOCK_EXT_DEPOSITS = 1_000
