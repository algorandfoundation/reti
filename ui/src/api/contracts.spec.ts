import { HttpResponse, http } from 'msw'
import { fetchPoolGlobalStates, isPoolGlobalStateComplete, processPoolData } from '@/api/contracts'
import { LocalPoolInfo } from '@/interfaces/validator'
import {
  LAST_ROUND,
  MOCK_ACCOUNT_MICROALGOS,
  MOCK_ACCOUNT_MIN_BALANCE,
  MOCK_EXT_DEPOSITS,
  MOCK_POOL_APY,
  RETI_APP_ADDRESS,
} from '@/utils/tests/constants'
import { appFixtures } from '@/utils/tests/fixtures/applications'
import { server } from '@/utils/tests/msw/server'

const AVAILABLE_BALANCE = BigInt(MOCK_ACCOUNT_MICROALGOS - MOCK_ACCOUNT_MIN_BALANCE)

function poolFixture(poolAppId: bigint): LocalPoolInfo {
  return { poolId: 1n, poolAppId, totalStakers: 1, totalAlgoStaked: 1_000n }
}

/** Records every algod path the code under test hits. */
function trackRequests() {
  const paths: string[] = []
  server.events.on('request:start', ({ request }) => {
    paths.push(new URL(request.url).pathname)
  })
  return paths
}

afterEach(() => {
  server.events.removeAllListeners()
})

describe('fetchPoolGlobalStates', () => {
  it('reads every pool in one request to the registry account', async () => {
    const paths = trackRequests()

    const states = await fetchPoolGlobalStates()

    expect(paths).toEqual([`/v2/accounts/${RETI_APP_ADDRESS}`])
    expect([...states.keys()]).toEqual([1010n, 1011n, 1020n])
  })

  it('decodes lastPayout as a uint and algodVer as bytes', async () => {
    const states = await fetchPoolGlobalStates()

    expect(states.get(1010n)).toEqual({
      lastPayout: 1000n,
      algodVer: '3.23.1 rel/stable [34171a94] : v0.8.2 [c58270f]',
    })
    // A pool whose node daemon has never reported has no algodVer, but still has lastPayout
    expect(states.get(1020n)).toEqual({ lastPayout: 1080n })
  })

  it('warns and returns what it got when algod truncates the created app list', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    server.use(
      http.get(`http://localhost:4001/v2/accounts/${RETI_APP_ADDRESS}`, () =>
        HttpResponse.json({
          address: RETI_APP_ADDRESS,
          amount: MOCK_ACCOUNT_MICROALGOS,
          'amount-without-pending-rewards': MOCK_ACCOUNT_MICROALGOS,
          'min-balance': MOCK_ACCOUNT_MIN_BALANCE,
          'pending-rewards': 0,
          rewards: 0,
          round: LAST_ROUND,
          status: 'Offline',
          'total-apps-opted-in': 0,
          'total-assets-opted-in': 0,
          // Reports more than it returns, which is how algod's resource cap presents
          'total-created-apps': 300,
          'total-created-assets': 0,
          'created-apps': [appFixtures['1010']],
        }),
      ),
    )

    const states = await fetchPoolGlobalStates()

    expect(states.size).toBe(1)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Truncated pool global state'))

    warn.mockRestore()
  })
})

describe('processPoolData', () => {
  it('uses the supplied global state instead of reading the pool app', async () => {
    const paths = trackRequests()

    const poolData = await processPoolData(poolFixture(1010n), { lastPayout: 1000n })

    expect(poolData).toEqual({
      balance: AVAILABLE_BALANCE,
      lastPayout: 1000n,
      apy: MOCK_POOL_APY,
      extDeposits: MOCK_EXT_DEPOSITS,
    })
    expect(paths.some((path) => path.startsWith('/v2/applications/'))).toBe(false)
  })

  it('falls back to a per-pool read for a pool the bulk request missed', async () => {
    const paths = trackRequests()

    const poolData = await processPoolData(poolFixture(1011n))

    expect(poolData.lastPayout).toBe(1050n)
    expect(paths).toContain('/v2/applications/1011')
  })

  it('recovers a pool whose bulk entry came back without lastPayout', async () => {
    const paths = trackRequests()

    // Truthy, so a presence check would accept it and leave lastPayout undefined - which the
    // Status column renders as "payouts stopped"
    const poolData = await processPoolData(poolFixture(1020n), { algodVer: '3.23.1' })

    expect(poolData.lastPayout).toBe(1080n)
    expect(paths).toContain('/v2/applications/1020')
  })

  it('does not re-read a complete entry that has no algodVer', async () => {
    const paths = trackRequests()

    const poolData = await processPoolData(poolFixture(1020n), { lastPayout: 1080n })

    expect(poolData.lastPayout).toBe(1080n)
    expect(poolData.balance).toBe(AVAILABLE_BALANCE)
    expect(paths.some((path) => path.startsWith('/v2/applications/'))).toBe(false)
  })
})

describe('isPoolGlobalStateComplete', () => {
  it('accepts an entry carrying lastPayout, with or without algodVer', () => {
    expect(isPoolGlobalStateComplete({ lastPayout: 1000n })).toBe(true)
    expect(isPoolGlobalStateComplete({ lastPayout: 0n, algodVer: '3.23.1' })).toBe(true)
  })

  it('rejects a missing or partially decoded entry', () => {
    expect(isPoolGlobalStateComplete(undefined)).toBe(false)
    expect(isPoolGlobalStateComplete({})).toBe(false)
    // algodVer alone is not enough - lastPayout is what every pool is guaranteed to have
    expect(isPoolGlobalStateComplete({ algodVer: '3.23.1' })).toBe(false)
  })
})
