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

/**
 * Результат запроса метаданных.
 *
 * Различает четыре состояния:
 * - 'found'     — найден результат.
 * - 'not-found' — сервер ответил, но результата нет (можно кэшировать).
 * - 'error'     — сетевая ошибка / 5xx / timeout (НЕ кэшировать).
 * - 'aborted'   — отмена через AbortSignal (НЕ кэшировать).
 */
export type MetadataFetchResult =
  | { status: 'found'; data: RemoteTrackMetadata }
  | { status: 'not-found' }
  | { status: 'error'; message: string }
  | { status: 'aborted' }

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
  ): Promise<MetadataFetchResult> {
    if (!title) return { status: 'not-found' }

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

      if (signal?.aborted) {
        return { status: 'aborted' }
      }

      // 4xx — считаем "не найдено" (не кэшируем ошибки клиента)
      if (res.status >= 400 && res.status < 500) {
        return { status: 'not-found' }
      }

      // 5xx — ошибка сервера, не кэшируем
      if (!res.ok) {
        return { status: 'error', message: `HTTP ${res.status}` }
      }

      const data = (await res.json()) as RemoteTrackMetadata | null

      if (!data) {
        return { status: 'not-found' }
      }

      return { status: 'found', data }
    } catch (err) {
      // Abort — отдельный статус
      if (err instanceof DOMException && err.name === 'AbortError') {
        return { status: 'aborted' }
      }

      // Всё остальное — error
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.warn(`[metadata] failed to fetch for "${artist} - ${title}"`, err)
      return { status: 'error', message }
    }
  }
}

export const trackMetadataService = TrackMetadataService.getInstance()
