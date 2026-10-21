// src/plugins/radio/RadioBrowserClient.ts

/**
 * Прямой клиент к Radio Browser API для эндпоинтов, которые
 * не оборачивает библиотека `radio-browser-api`:
 * - `/json/countries`
 * - `/json/tags`
 *
 * Библиотека используется для поиска станций (`searchStations`,
 * `getStationsBy`) — там её типы и обработка удобнее.
 */

// Базовый URL. При необходимости можно добавить фолбэки на другие зеркала
// (de2.api.radio-browser.info, at1.api.radio-browser.info).
const API_BASE = 'https://de1.api.radio-browser.info'

const REQUEST_TIMEOUT_MS = 10_000

export interface RadioCountry {
  name: string
  code: string
  stationCount: number
}

export interface RadioTag {
  name: string
  stationCount: number
}

interface RawCountry {
  name: string
  iso_3166_1: string
  stationcount: number
}

interface RawTag {
  name: string
  stationcount: number
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })

    if (!res.ok) {
      console.error('[radio-browser] HTTP', res.status, url)
      return null
    }

    const contentType = res.headers.get('content-type') ?? ''
    if (!contentType.includes('application/json')) {
      const text = await res.text()
      console.error('[radio-browser] unexpected content-type', contentType, url, text.slice(0, 200))
      return null
    }

    return (await res.json()) as T
  } catch (err) {
    console.error('[radio-browser] request failed', url, err)
    return null
  }
}

export class RadioBrowserClient {
  private static instance: RadioBrowserClient | null = null

  static getInstance(): RadioBrowserClient {
    if (!RadioBrowserClient.instance) {
      RadioBrowserClient.instance = new RadioBrowserClient()
    }
    return RadioBrowserClient.instance
  }

  /**
   * Список стран (по алфавиту).
   * Возвращает null при ошибке сети/парсинга, [] при пустом успешном ответе.
   */
  async getCountries(): Promise<RadioCountry[] | null> {
    const data = await fetchJson<RawCountry[]>(`${API_BASE}/json/countries`)
    if (data === null) return null
    if (!Array.isArray(data)) {
      console.error('[radio-browser] countries: response is not an array')
      return null
    }

    return data
      .filter((c) => Boolean(c.name))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
      .map((c) => ({
        name: c.name,
        code: c.iso_3166_1,
        stationCount: c.stationcount ?? 0,
      }))
  }

  /**
   * Список популярных тегов (по алфавиту).
   * Возвращает null при ошибке, [] при пустом успешном ответе.
   */
  async getTags(limit = 20): Promise<RadioTag[] | null> {
    const url = `${API_BASE}/json/tags?hidebroken=true&order=stationcount&reverse=true&limit=${limit}`
    const data = await fetchJson<RawTag[]>(url)
    if (data === null) return null
    if (!Array.isArray(data)) {
      console.error('[radio-browser] tags: response is not an array')
      return null
    }

    return data
      .filter((t) => Boolean(t.name))
      .map((t) => ({
        name: t.name,
        stationCount: t.stationcount ?? 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  }
}

export const radioBrowserClient = RadioBrowserClient.getInstance()
