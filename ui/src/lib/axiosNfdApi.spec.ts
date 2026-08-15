import { HttpResponse, http } from 'msw'
import axiosNfdApi from '@/lib/axiosNfdApi'
import { server } from '@/utils/tests/msw/server'

const BASE_URL = 'http://localhost'

/** Unique per test so one test's cache entry can't answer another's request. */
function probeUrl(name: string) {
  return `/nfd-retry-probe/${name}`
}

describe('axiosNfdApi', () => {
  /**
   * Regression test for the interceptor ordering. Registering `axiosRetry` before `setupCache`
   * makes the retry swallow the rejection before the cache can settle the entry it opened for
   * the request, and the retry then blocks forever on that entry - so this hangs to the test
   * timeout rather than failing an assertion.
   */
  it('retries a rate limited request instead of hanging on the cache entry', async () => {
    const url = probeUrl('rate-limited')
    let hits = 0

    server.use(
      http.get(`${BASE_URL}${url}`, () => {
        hits += 1
        return hits === 1
          ? new HttpResponse(null, { status: 429 })
          : HttpResponse.json({ name: 'reti.algo' })
      }),
    )

    const response = await axiosNfdApi.get(url)

    expect(response.status).toBe(200)
    expect(response.data).toEqual({ name: 'reti.algo' })
    expect(hits).toBe(2)
  })

  it('gives up and rejects once the response is not retryable', async () => {
    const url = probeUrl('not-found')
    let hits = 0

    server.use(
      http.get(`${BASE_URL}${url}`, () => {
        hits += 1
        return new HttpResponse(null, { status: 404 })
      }),
    )

    await expect(axiosNfdApi.get(url)).rejects.toMatchObject({ response: { status: 404 } })
    expect(hits).toBe(1)
  })

  it('still serves a repeat request from the cache', async () => {
    const url = probeUrl('cached')
    let hits = 0

    server.use(
      http.get(`${BASE_URL}${url}`, () => {
        hits += 1
        return HttpResponse.json({ name: 'reti.algo' })
      }),
    )

    const first = await axiosNfdApi.get(url)
    const second = await axiosNfdApi.get(url)

    expect(first.cached).toBe(false)
    expect(second.cached).toBe(true)
    expect(second.data).toEqual({ name: 'reti.algo' })
    expect(hits).toBe(1)
  })
})
