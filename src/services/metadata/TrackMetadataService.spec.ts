// oxlint-disable vitest/require-mock-type-parameters
// src/services/metadata/TrackMetadataService.spec.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { trackMetadataService } from './TrackMetadataService'

const fetchMock = vi.fn()

const originalFetch = globalThis.fetch

beforeEach(() => {
  globalThis.fetch = fetchMock as unknown as typeof fetch
  fetchMock.mockReset()
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

function mockResponse(data: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => data,
  } as unknown as Response
}

describe('TrackMetadataService', () => {
  it('not-found при пустом title', async () => {
    const result = await trackMetadataService.fetch('', '', 0.5)
    expect(result.status).toBe('not-found')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('found с полными данными', async () => {
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

    expect(result.status).toBe('found')
    if (result.status !== 'found') throw new Error('expected found')

    expect(result.data.similarity).toBe(1)
    expect(fetchMock).toHaveBeenCalledOnce()

    const calledUrl = fetchMock.mock.calls[0]![0] as string
    expect(calledUrl).toContain('title=Karma+Police')
    expect(calledUrl).toContain('artist=Radiohead')
    expect(calledUrl).toContain('threshold=0.5')
  })

  it('не передаёт artist, если он пустой', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(null))

    await trackMetadataService.fetch('', 'Karma Police', 0.85)

    const calledUrl = fetchMock.mock.calls[0]![0] as string
    expect(calledUrl).not.toContain('artist=')
    expect(calledUrl).toContain('threshold=0.85')
  })

  it('error при сетевой ошибке', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network'))

    const result = await trackMetadataService.fetch('A', 'T', 0.5)
    expect(result.status).toBe('error')
    if (result.status !== 'error') throw new Error('expected error')
    expect(result.message).toContain('network')
  })

  it('error при 5xx', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(null, false, 500))

    const result = await trackMetadataService.fetch('A', 'T', 0.5)
    expect(result.status).toBe('error')
    if (result.status !== 'error') throw new Error('expected error')
    expect(result.message).toBe('HTTP 500')
  })

  it('not-found при 4xx', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(null, false, 404))

    const result = await trackMetadataService.fetch('A', 'T', 0.5)
    expect(result.status).toBe('not-found')
  })

  it('aborted при AbortError', async () => {
    fetchMock.mockRejectedValueOnce(new DOMException('Aborted', 'AbortError'))

    const result = await trackMetadataService.fetch('A', 'T', 0.5)
    expect(result.status).toBe('aborted')
  })

  it('not-found, если сервер вернул null', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(null))

    const result = await trackMetadataService.fetch('A', 'T', 0.5)
    expect(result.status).toBe('not-found')
  })

  it('found с candidates', async () => {
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
    expect(result.status).toBe('found')
    if (result.status !== 'found') throw new Error('expected found')

    expect(result.data.candidates).toHaveLength(2)
    expect(result.data.confident).toBe(false)
  })
})
