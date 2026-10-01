// oxlint-disable vitest/require-mock-type-parameters
// src/services/metadata/TrackMetadataService.spec.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { trackMetadataService, type RemoteTrackMetadata } from './TrackMetadataService'

const fetchMock = vi.fn()

const originalFetch = globalThis.fetch

beforeEach(() => {
  globalThis.fetch = fetchMock as unknown as typeof fetch
  fetchMock.mockReset()
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

function mockResponse(data: RemoteTrackMetadata | null, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => data,
  } as unknown as Response
}

describe('TrackMetadataService', () => {
  it('возвращает null при пустом title', async () => {
    const result = await trackMetadataService.fetch('', '', 0.5)
    expect(result).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('делает запрос с artist, title, threshold', async () => {
    fetchMock.mockResolvedValueOnce(
      mockResponse({
        artist: 'Radiohead',
        title: 'Karma Police',
        album: 'OK Computer',
        coverUrl: 'https://cover',
        source: 'itunes',
        similarity: 1,
        confident: true,
      }),
    )

    const result = await trackMetadataService.fetch('Radiohead', 'Karma Police', 0.5)

    expect(result).not.toBeNull()
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('не передаёт artist, если он пустой', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(null))

    await trackMetadataService.fetch('', 'Karma Police', 0.85)

    const calledUrl = fetchMock.mock.calls[0]![0] as string
    expect(calledUrl).not.toContain('artist=')
    expect(calledUrl).toContain('threshold=0.85')
  })

  it('возвращает null при ошибке сети', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network'))

    const result = await trackMetadataService.fetch('A', 'T', 0.5)
    expect(result).toBeNull()
  })

  it('возвращает null при !res.ok', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(null, false, 500))

    const result = await trackMetadataService.fetch('A', 'T', 0.5)
    expect(result).toBeNull()
  })

  it('возвращает null при AbortError', async () => {
    const abortError = new DOMException('Aborted', 'AbortError')
    fetchMock.mockRejectedValueOnce(abortError)

    const result = await trackMetadataService.fetch('A', 'T', 0.5)
    expect(result).toBeNull()
  })

  it('возвращает candidates, если есть', async () => {
    fetchMock.mockResolvedValueOnce(
      mockResponse({
        artist: 'A',
        title: 'T',
        album: 'Al',
        coverUrl: null,
        source: 'itunes',
        similarity: 0.5,
        confident: false,
        candidates: [
          {
            artist: 'A',
            title: 'T',
            album: 'Al',
            coverUrl: null,
            source: 'itunes',
            similarity: 0.5,
          },
          {
            artist: 'B',
            title: 'U',
            album: 'Al2',
            coverUrl: 'https://c',
            source: 'deezer',
            similarity: 0.4,
          },
        ],
      }),
    )

    const result = await trackMetadataService.fetch('A', 'T', 0.5)
    expect(result!.candidates).toHaveLength(2)
    expect(result!.confident).toBe(false)
  })
})
