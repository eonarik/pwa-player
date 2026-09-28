// src/services/covers/CoverService.ts

const PROXY_URL = (import.meta.env.VITE_DISK_PROXY_URL ?? '').replace(/\/+$/, '')
const REQUEST_TIMEOUT_MS = 10_000

class CoverService {
  private static instance: CoverService | null = null

  static getInstance(): CoverService {
    if (!CoverService.instance) {
      CoverService.instance = new CoverService()
    }
    return CoverService.instance
  }

  /**
   * Ищет обложку через прокси (iTunes + Deezer).
   * Возвращает URL или null.
   */
  async fetch(artist: string, title: string): Promise<string | null> {
    if (!title) return null

    try {
      const params = new URLSearchParams({ title })
      if (artist && artist !== 'Yandex Disk') {
        params.set('artist', artist)
      }

      const res = await fetch(`${PROXY_URL}/api/cover?${params.toString()}`, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })

      if (!res.ok) return null

      const data = (await res.json()) as { coverUrl: string | null }
      return data.coverUrl
    } catch (err) {
      console.warn(`[covers] failed to fetch for "${artist} - ${title}"`, err)
      return null
    }
  }
}

export const coverService = CoverService.getInstance()
