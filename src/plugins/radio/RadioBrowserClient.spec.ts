// src/plugins/radio/RadioBrowserClient.spec.ts
// oxlint-disable vitest/require-mock-type-parameters

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { RadioBrowserClient } from './RadioBrowserClient'

const fetchMock = vi.fn()
const originalFetch = globalThis.fetch

beforeEach(() => {
  globalThis.fetch = fetchMock as unknown as typeof fetch
  fetchMock.mockReset()
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

function createClient(): RadioBrowserClient {
  return new RadioBrowserClient()
}

function jsonResponse(data: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as unknown as Response
}

describe('RadioBrowserClient', () => {
  describe('getCountries', () => {
    it('возвращает отсортированный список', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse([
          { name: 'Россия', iso_3166_1: 'RU', stationcount: 100 },
          { name: 'Германия', iso_3166_1: 'DE', stationcount: 50 },
        ]),
      )

      const client = createClient()
      const result = await client.getCountries()

      expect(result).not.toBeNull()
      expect(result).toHaveLength(2)
      expect(result![0]!.name).toBe('Германия')
      expect(result![1]!.name).toBe('Россия')
      expect(result![0]!.stationCount).toBe(50)
    })

    it('null при HTTP-ошибке', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(null, false, 500))
      const client = createClient()
      expect(await client.getCountries()).toBeNull()
    })

    it('null при не-JSON content-type', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/html' }),
        text: async () => '<html>maintenance</html>',
      } as unknown as Response)

      const client = createClient()
      expect(await client.getCountries()).toBeNull()
    })

    it('null при сетевой ошибке', async () => {
      fetchMock.mockRejectedValueOnce(new Error('network'))
      const client = createClient()
      expect(await client.getCountries()).toBeNull()
    })

    it('[] при пустом успешном ответе', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse([]))
      const client = createClient()
      expect(await client.getCountries()).toEqual([])
    })

    it('фильтрует записи без name', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse([
          { name: '', iso_3166_1: 'XX', stationcount: 1 },
          { name: 'Россия', iso_3166_1: 'RU', stationcount: 100 },
        ]),
      )

      const client = createClient()
      const result = await client.getCountries()
      expect(result).toHaveLength(1)
      expect(result![0]!.code).toBe('RU')
    })
  })

  describe('getTags', () => {
    it('возвращает отсортированный список', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse([
          { name: 'rock', stationcount: 500 },
          { name: 'jazz', stationcount: 300 },
        ]),
      )

      const client = createClient()
      const result = await client.getTags(100)

      expect(result).not.toBeNull()
      expect(result).toHaveLength(2)
      expect(result![0]!.name).toBe('jazz')
      expect(result![0]!.stationCount).toBe(300)
    })

    it('null при HTTP-ошибке', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(null, false, 503))
      const client = createClient()
      expect(await client.getTags(100)).toBeNull()
    })

    it('[] при пустом ответе', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse([]))
      const client = createClient()
      expect(await client.getTags(100)).toEqual([])
    })
  })
})
