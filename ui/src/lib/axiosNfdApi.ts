import Axios, { AxiosError } from 'axios'
import { buildMemoryStorage, buildWebStorage, setupCache } from 'axios-cache-interceptor'
import axiosRetry from 'axios-retry'
import queryString from 'query-string'
import { getNfdApiFromViteEnvironment } from '@/utils/network/getNfdConfig'

/** NFD records (names, avatars, verified fields) change rarely - treat them as near-static. */
const NFD_CACHE_TTL = 1000 * 60 * 60 * 6 // 6 hours
const NFD_MAX_STALE_AGE = 1000 * 60 * 60 * 24 // 1 day

const instance = Axios.create({
  baseURL: getNfdApiFromViteEnvironment(),
  paramsSerializer: (params) => queryString.stringify(params),
})

/**
 * Backing store for the HTTP cache. Persisting to localStorage means a reload starts with the
 * names and avatars it already had instead of replaying every lookup. Private browsing modes
 * expose localStorage but throw on write, so fall back to memory.
 */
function buildNfdCacheStorage() {
  try {
    const probe = '__reti_nfd_cache_probe__'
    window.localStorage.setItem(probe, probe)
    window.localStorage.removeItem(probe)
    return buildWebStorage(window.localStorage, 'reti-nfd-cache:', NFD_MAX_STALE_AGE)
  } catch {
    return buildMemoryStorage()
  }
}

const axiosNfdApi = setupCache(instance, {
  ttl: NFD_CACHE_TTL,
  // The API advertises a short max-age; our own TTL is the one that matters for this data
  interpretHeader: false,
  storage: buildNfdCacheStorage(),
  // Serving a stale name beats showing an address when the API is down
  staleIfError: true,
})

/**
 * Resolving a few hundred validator names on dashboard load is enough to draw 429s.
 *
 * This call has to come *after* `setupCache`, and the ordering is load bearing: axios runs
 * response interceptors in registration order, so registering retry first lets it swallow the
 * rejection before the cache's own response handler ever sees it. The cache then never settles
 * the pending entry it opened for that request, and the retry - which re-enters the whole
 * interceptor chain under the same cache key - blocks forever waiting on that entry. Retrying
 * last means each failed attempt unwinds through the cache before the next one starts.
 *
 * `setupCache` augments and returns the same instance, so it is the position of this call that
 * matters, not which reference is passed. Covered by ./axiosNfdApi.spec.ts.
 */
axiosRetry(axiosNfdApi, {
  retries: 5,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error: AxiosError) =>
    axiosRetry.isRetryableError(error) || error?.response?.status === 429,
})

export default axiosNfdApi
