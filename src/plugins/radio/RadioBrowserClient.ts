// src/plugins/radio/RadioBrowserClient.ts

const API_BASE = 'https://de1.api.radio-browser.info'
const REQUEST_TIMEOUT_MS = 10_000

/** «Свежий» TTL: до него — не обновляем. После — пробуем обновить. */
const COUNTRIES_TTL_MS = 24 * 60 * 60 * 1000
const TAGS_TTL_MS = 24 * 60 * 60 * 1000

const COUNTRIES_STORAGE_KEY = 'radio:cache:countries'
const TAGS_STORAGE_KEY = 'radio:cache:tags'

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

interface PersistedCache<T> {
  data: T
  fetchedAt: number
}

interface CacheReadResult<T> {
  data: T
  age: number
  fresh: boolean
}

/**
 * Читает кеш. Не удаляет запись при истечении TTL — просроченные данные
 * могут быть единственным спасением, если сервер недоступен.
 */
function readCache<T>(key: string, ttl: number): CacheReadResult<T> | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedCache<T>
    if (!parsed || typeof parsed.fetchedAt !== 'number') return null
    const age = Date.now() - parsed.fetchedAt
    return { data: parsed.data, age, fresh: age < ttl }
  } catch {
    return null
  }
}

function writeCache<T>(key: string, data: T): void {
  try {
    const payload: PersistedCache<T> = { data, fetchedAt: Date.now() }
    localStorage.setItem(key, JSON.stringify(payload))
  } catch (err) {
    console.warn('[radio-browser] failed to persist cache', key, err)
  }
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

  private countriesInFlight: Promise<RadioCountry[] | null> | null = null
  private tagsInFlight: Map<number, Promise<RadioTag[] | null>> = new Map()

  static getInstance(): RadioBrowserClient {
    if (!RadioBrowserClient.instance) {
      RadioBrowserClient.instance = new RadioBrowserClient()
    }
    return RadioBrowserClient.instance
  }

  /**
   * Список стран. Логика:
   * - Свежий кеш (< 24 ч) — отдаём без запроса.
   * - Просроченный кеш — пробуем обновить; при ошибке отдаём старый.
   * - Нет кеша — запрос; при ошибке — null.
   */
  async getCountries(): Promise<RadioCountry[] | null> {
    const cached = readCache<RadioCountry[]>(COUNTRIES_STORAGE_KEY, COUNTRIES_TTL_MS)

    if (cached?.fresh) {
      if (import.meta.env.DEV) console.debug('[radio-browser] countries HIT (fresh)')
      return cached.data
    }

    if (this.countriesInFlight) return this.countriesInFlight

    if (import.meta.env.DEV) {
      console.debug('[radio-browser] countries MISS', cached ? '(stale, refreshing)' : '(no cache)')
    }

    this.countriesInFlight = (async () => {
      const data = await fetchJson<RawCountry[]>(`${API_BASE}/json/countries`)
      if (data === null) {
        if (cached) {
          console.warn('[radio-browser] countries refresh failed, using stale cache')
          return cached.data
        }
        return null
      }

      if (!Array.isArray(data)) {
        console.error('[radio-browser] countries: response is not an array')
        return cached?.data ?? null
      }

      const mapped = data
        .filter((c) => Boolean(c.name))
        .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
        .map((c) => ({
          name: c.name,
          code: c.iso_3166_1,
          stationCount: c.stationcount ?? 0,
        }))

      writeCache(COUNTRIES_STORAGE_KEY, mapped)
      return mapped
    })().finally(() => {
      this.countriesInFlight = null
    })

    return this.countriesInFlight
  }

  /**
   * Список тегов. Логика как у стран.
   */
  async getTags(limit = 20): Promise<RadioTag[] | null> {
    const key = `${TAGS_STORAGE_KEY}:${limit}`
    const cached = readCache<RadioTag[]>(key, TAGS_TTL_MS)

    if (cached?.fresh) {
      if (import.meta.env.DEV) console.debug('[radio-browser] tags HIT (fresh)', limit)
      return cached.data
    }

    const inFlight = this.tagsInFlight.get(limit)
    if (inFlight) return inFlight

    if (import.meta.env.DEV) {
      console.debug(
        '[radio-browser] tags MISS',
        limit,
        cached ? '(stale, refreshing)' : '(no cache)',
      )
    }

    const promise = (async () => {
      const url = `${API_BASE}/json/tags?hidebroken=true&order=stationcount&reverse=true&limit=${limit}`
      const data = await fetchJson<RawTag[]>(url)

      if (data === null) {
        if (cached) {
          console.warn('[radio-browser] tags refresh failed, using stale cache', limit)
          return cached.data
        }
        return null
      }

      if (!Array.isArray(data)) {
        console.error('[radio-browser] tags: response is not an array')
        return cached?.data ?? null
      }

      const mapped = data
        .filter((t) => Boolean(t.name))
        .map((t) => ({
          name: t.name,
          stationCount: t.stationcount ?? 0,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'ru'))

      writeCache(key, mapped)
      return mapped
    })().finally(() => {
      this.tagsInFlight.delete(limit)
    })

    this.tagsInFlight.set(limit, promise)
    return promise
  }

  clearCache(): void {
    try {
      localStorage.removeItem(COUNTRIES_STORAGE_KEY)
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith(TAGS_STORAGE_KEY)) localStorage.removeItem(key)
      }
    } catch {
      // ignore
    }
  }
}

export const radioBrowserClient = RadioBrowserClient.getInstance()
