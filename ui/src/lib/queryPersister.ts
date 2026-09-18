import { Query, QueryClient } from '@tanstack/react-query'
import {
  PersistedClient,
  Persister,
  PersistQueryClientOptions,
  persistQueryClientRestore,
  persistQueryClientSubscribe,
} from '@tanstack/react-query-persist-client'

/**
 * Query key roots that survive a page reload.
 *
 * Deliberately an allowlist rather than "persist everything": account balances and staking
 * positions are volatile and wallet-scoped, and painting a stale one would be worse than a
 * spinner. What is here is either expensive (validator metrics cost three algod/Nodely calls
 * per pool), rate limited and near-static (NFD), or the whole dashboard in one entry
 * (`all-validators`), which is what makes the first paint instant.
 */
const PERSISTED_QUERY_ROOTS = new Set([
  'all-validators',
  'pool-global-states',
  'validator-metrics',
  'nfd',
  'nfd-lookup',
  'ipfs-url',
])

/** Nothing older than this is rehydrated, however long it sat in storage. */
const MAX_AGE = 1000 * 60 * 60 * 24 // 24 hours

/**
 * Writes fire on every cache mutation, and with metrics streaming in behind a 30 second
 * `all-validators` refetch that is constant. Coalesce them.
 */
const WRITE_THROTTLE = 1000 * 5 // 5 seconds

/** Guards first paint against a wedged storage layer. */
const RESTORE_TIMEOUT = 1000 * 2 // 2 seconds

const DB_NAME = 'reti-query-cache'
const STORE_NAME = 'cache'
const ENTRY_KEY = 'client'

let dbPromise: Promise<IDBDatabase | null> | undefined

/**
 * Resolves `null` rather than rejecting when IndexedDB is missing or blocked (private
 * browsing, another tab holding an older version). Every caller then degrades to no
 * persistence instead of failing.
 */
function openDatabase(): Promise<IDBDatabase | null> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      if (typeof indexedDB === 'undefined') {
        resolve(null)
        return
      }
      const request = indexedDB.open(DB_NAME, 1)
      request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(null)
      request.onblocked = () => resolve(null)
    })
  }
  return dbPromise
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | undefined> {
  const db = await openDatabase()
  if (!db) {
    return undefined
  }
  return new Promise<T | undefined>((resolve) => {
    const transaction = db.transaction(STORE_NAME, mode)
    const request = run(transaction.objectStore(STORE_NAME))
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => resolve(undefined)
    transaction.onabort = () => resolve(undefined)
  })
}

function throttle<TArgs extends unknown[]>(fn: (...args: TArgs) => void, wait: number) {
  let timer: ReturnType<typeof setTimeout> | null = null
  let latest: TArgs

  return (...args: TArgs) => {
    latest = args
    if (timer) {
      return
    }
    timer = setTimeout(() => {
      timer = null
      fn(...latest)
    }, wait)
  }
}

/**
 * IndexedDB stores values through the structured clone algorithm, which handles `bigint`
 * natively. That is the reason for using it over localStorage here: protocol data is full of
 * bigints (stake amounts, app ids, round numbers) and any JSON-backed persister would need a
 * hand-rolled codec, with silent corruption as the failure mode.
 *
 * @param writeThrottle - overridable so tests don't have to wait out the real interval
 */
export function createQueryCachePersister(writeThrottle = WRITE_THROTTLE): Persister {
  return {
    persistClient: throttle((client: PersistedClient) => {
      void withStore('readwrite', (store) => store.put(client, ENTRY_KEY))
    }, writeThrottle),

    restoreClient: () => withStore<PersistedClient>('readonly', (store) => store.get(ENTRY_KEY)),

    removeClient: async () => {
      await withStore('readwrite', (store) => store.delete(ENTRY_KEY))
    },
  }
}

export const persister = createQueryCachePersister()

export const persistOptions: Omit<PersistQueryClientOptions, 'queryClient'> = {
  persister,
  maxAge: MAX_AGE,
  // A deploy can change the shape of what we cached; never hydrate across app versions
  buster: __APP_VERSION__,
  dehydrateOptions: {
    shouldDehydrateQuery: (query: Query) =>
      query.state.status === 'success' && PERSISTED_QUERY_ROOTS.has(String(query.queryKey[0])),
  },
}

/**
 * Hydrates the cache from disk, then keeps writing it back.
 *
 * Must complete before the router starts loading: the dashboard route prefetches
 * `all-validators` in `beforeLoad`, and a restore that lands after that request has already
 * gone out defeats the point of persisting it. Never rejects - the app renders off the back of
 * this, so a storage failure has to degrade to "no persistence", not "no app".
 */
export async function hydrateQueryCache(queryClient: QueryClient): Promise<void> {
  try {
    await Promise.race([
      persistQueryClientRestore({ queryClient, ...persistOptions }),
      new Promise((resolve) => setTimeout(resolve, RESTORE_TIMEOUT)),
    ])
    persistQueryClientSubscribe({ queryClient, ...persistOptions })
  } catch (error) {
    console.warn('Query cache persistence unavailable:', error)
  }
}
