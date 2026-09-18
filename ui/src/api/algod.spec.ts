import { HttpResponse, http } from 'msw'
import { BoxValuesUnsupportedError, fetchAppBoxes } from '@/api/algod'
import { server } from '@/utils/tests/msw/server'
import { VALIDATOR_BOX_PREFIX, decodeValidatorBoxName } from '@/utils/contracts'

const RETI_APP_ID = 1002n

describe('fetchAppBoxes', () => {
  it('returns every box with its value in a single request', async () => {
    const { boxes, round } = await fetchAppBoxes(RETI_APP_ID, { prefix: VALIDATOR_BOX_PREFIX })

    expect(boxes).toHaveLength(2)
    expect(boxes.map((box) => decodeValidatorBoxName(box.name))).toEqual([1, 2])
    boxes.forEach((box) => expect(box.value.length).toBeGreaterThan(0))
    expect(round).toBeGreaterThan(0)
  })

  it('pages through results and pins every page to the first page round', async () => {
    const requestedRounds: (string | null)[] = []

    server.events.on('request:start', ({ request }) => {
      const url = new URL(request.url)
      if (url.pathname.endsWith('/boxes')) {
        requestedRounds.push(url.searchParams.get('round'))
      }
    })

    const { boxes, round } = await fetchAppBoxes(RETI_APP_ID, {
      prefix: VALIDATOR_BOX_PREFIX,
      pageSize: 1,
    })

    // Same result as an unpaginated read
    expect(boxes.map((box) => decodeValidatorBoxName(box.name))).toEqual([1, 2])

    // First page unpinned, every subsequent page pinned to the round it returned
    expect(requestedRounds.length).toBeGreaterThan(1)
    expect(requestedRounds[0]).toBeNull()
    requestedRounds.slice(1).forEach((value) => expect(value).toBe(String(round)))

    server.events.removeAllListeners('request:start')
  })

  it('throws when the node returns names without values', async () => {
    server.use(
      http.get('http://localhost:4001/v2/applications/:id/boxes', () =>
        HttpResponse.json({ boxes: [{ name: 'dg==' }], round: 1 }),
      ),
    )

    await expect(fetchAppBoxes(RETI_APP_ID)).rejects.toThrow(BoxValuesUnsupportedError)
  })
})
