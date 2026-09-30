// src/services/metadata/TrackMetadataService.ts

const PROXY_URL = (import.meta.env.VITE_DISK_PROXY_URL ?? '').replace(/\/+$/, '')
const REQUEST_TIMEOUT_MS = 10_000

export interface MetadataCandidate {
  artist: string
  title: string
  album: string
  coverUrl: string | null
  source: 'itunes' | 'deezer'
  similarity: number
}

export interface RemoteTrackMetadata {
  artist: string
  title: string
  album: string
  coverUrl: string | null
  source: 'itunes' | 'deezer'
  similarity: number
  confident: boolean
  candidates?: MetadataCandidate[]
}

class TrackMetadataService {
  private static instance: TrackMetadataService | null = null

  static getInstance(): TrackMetadataService {
    if (!TrackMetadataService.instance) {
      TrackMetadataService.instance = new TrackMetadataService()
    }
    return TrackMetadataService.instance
  }

  /**
   * Ищет метаданные через прокси (iTunes → Deezer на бэке).
   * Threshold передаётся в query — от него зависит confident на бэке.
   */
  async fetch(
    artist: string,
    title: string,
    threshold: number,
    signal?: AbortSignal,
  ): Promise<RemoteTrackMetadata | null> {
    if (!title) return null

    try {
      const params = new URLSearchParams({
        title,
        threshold: String(threshold),
      })
      if (artist) {
        params.set('artist', artist)
      }

      const res = await fetch(`${PROXY_URL}/api/track-metadata?${params.toString()}`, {
        signal: signal
          ? AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)])
          : AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })

      if (!res.ok) return null

      const data = (await res.json()) as RemoteTrackMetadata | null
      return data
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return null
      }
      console.warn(`[metadata] failed to fetch for "${artist} - ${title}"`, err)
      return null
    }
  }
}

export const trackMetadataService = TrackMetadataService.getInstance()
