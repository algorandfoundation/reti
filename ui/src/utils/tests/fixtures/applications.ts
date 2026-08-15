import { ALGORAND_ZERO_ADDRESS_STRING } from '@/constants/accounts'
import { Application, TealKeyValue } from '@/interfaces/algod'

interface FixtureData {
  [appId: string]: Application
}

const ALGOD_VERSION = '3.23.1 rel/stable [34171a94] : v0.8.2 [c58270f]'

/** Type 1 is bytes, type 2 is uint, matching algod's TealValue encoding. */
function bytesValue(key: string, value: string): TealKeyValue {
  return {
    key: Buffer.from(key, 'utf-8').toString('base64'),
    value: { type: 1, bytes: Buffer.from(value, 'utf-8').toString('base64'), uint: 0 },
  }
}

function uintValue(key: string, value: number): TealKeyValue {
  return {
    key: Buffer.from(key, 'utf-8').toString('base64'),
    value: { type: 2, bytes: '', uint: value },
  }
}

function stakingPool(appId: number, globalState: TealKeyValue[]): Application {
  return {
    id: appId,
    params: {
      'approval-program': Buffer.from('', 'utf-8').toString('base64'),
      'clear-state-program': Buffer.from('', 'utf-8').toString('base64'),
      creator: ALGORAND_ZERO_ADDRESS_STRING,
      'global-state': globalState,
    },
  }
}

/**
 * Map containing each application's fixture data. Every staking pool here is also served as a
 * created app of the validator registry's account, mirroring how they're read in bulk.
 */
export const appFixtures: FixtureData = {
  '1010': stakingPool(1010, [bytesValue('algodVer', ALGOD_VERSION), uintValue('lastPayout', 1000)]),
  '1011': stakingPool(1011, [bytesValue('algodVer', ALGOD_VERSION), uintValue('lastPayout', 1050)]),
  // No lastPayout: stands in for a pool that has never paid out
  '1020': stakingPool(1020, [bytesValue('algodVer', ALGOD_VERSION)]),
}
