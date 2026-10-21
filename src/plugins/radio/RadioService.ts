// src/plugins/radio/RadioService.ts

import { RadioBrowserApi, StationSearchType } from 'radio-browser-api'
import type { Station } from 'radio-browser-api'
import { radioBrowserClient, type RadioCountry, type RadioTag } from './RadioBrowserClient'

export type { RadioCountry, RadioTag }

export type RadioSortOrder = 'clickCount' | 'votes' | 'clickTrend' | 'random' | 'bitrate' | 'name'

export interface RadioStation {
  id: string
  name: string
  url: string
  favicon: string
  tags: string[]
  country: string
  bitrate: number
}

export interface TopStationsResult {
  stations: RadioStation[]
  total: number
}

export interface SearchStationsOptions {
  countryCode?: string
  tags?: string[]
  order?: RadioSortOrder
}

const RESULT_TTL_MS = 5 * 60 * 1000

const TOP_STORAGE_KEY = 'radio:cache:top'
const SEARCH_STORAGE_KEY = 'radio:cache:search'

interface PersistedResultCache {
  key: string
  data: TopStationsResult
  fetchedAt: number
}

interface ResultCacheRead {
  data: TopStationsResult
  fresh: boolean
}

function readResultCache(storageKey: string, key: string): ResultCacheRead | null {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedResultCache
    if (!parsed || typeof parsed.fetchedAt !== 'number') return null
    if (parsed.key !== key) return null
    const age = Date.now() - parsed.fetchedAt
    return { data: parsed.data, fresh: age < RESULT_TTL_MS }
  } catch {
    return null
  }
}

function writeResultCache(storageKey: string, key: string, data: TopStationsResult): void {
  try {
    const payload: PersistedResultCache = { key, data, fetchedAt: Date.now() }
    localStorage.setItem(storageKey, JSON.stringify(payload))
  } catch (err) {
    console.warn('[radio] failed to persist result cache', storageKey, err)
  }
}

class RadioService {
  private static instance: RadioService | null = null
  private api: RadioBrowserApi

  private topInFlight: Map<string, Promise<TopStationsResult>> = new Map()
  private searchInFlight: Map<string, Promise<TopStationsResult>> = new Map()

  /** true, если последний результат отдан из stale-кеша (сервер недоступен). */
  isStale = false

  /** Сообщение об ошибке последнего запроса (если был). */
  lastError: string | null = null

  private constructor() {
    this.api = new RadioBrowserApi('CUEI Media Player')
  }

  static getInstance(): RadioService {
    if (!RadioService.instance) {
      RadioService.instance = new RadioService()
    }
    return RadioService.instance
  }

  getCountries(): Promise<RadioCountry[] | null> {
    return radioBrowserClient.getCountries()
  }

  getTags(limit = 20): Promise<RadioTag[] | null> {
    return radioBrowserClient.getTags(limit)
  }

  async searchByTag(tag: string, limit = 20): Promise<RadioStation[]> {
    try {
      const stations = await this.api.getStationsBy(StationSearchType.byTag, tag, {
        limit,
        hideBroken: true,
      })
      return this.filterAndMap(stations)
    } catch (err) {
      console.error('[radio] searchByTag failed', err)
      return []
    }
  }

  async searchByName(
    name: string,
    limit = 20,
    options: SearchStationsOptions = {},
  ): Promise<TopStationsResult> {
    const offset = 0
    const key = this.buildKey('search', name, limit, offset, options)

    this.isStale = false
    this.lastError = null

    const cached = readResultCache(SEARCH_STORAGE_KEY, key)

    if (cached?.fresh) {
      if (import.meta.env.DEV) console.debug('[radio] search HIT (fresh)', key)
      return cached.data
    }

    const inFlight = this.searchInFlight.get(key)
    if (inFlight) return inFlight

    if (import.meta.env.DEV) {
      console.debug('[radio] search MISS', key, cached ? '(stale, refreshing)' : '(no cache)')
    }

    const promise = (async () => {
      try {
        const rawLimit = limit * 3
        const query: Record<string, unknown> = {
          name,
          limit: rawLimit,
          offset,
          hideBroken: true,
        }

        if (options.countryCode) query.countryCode = options.countryCode
        if (options.tags && options.tags.length > 0) query.tagList = options.tags

        if (options.order) {
          query.order = options.order
          query.reverse = options.order !== 'name'
        }

        const raw = await this.api.searchStations(query)
        const filtered = this.filterAndMap(raw)

        const result: TopStationsResult = {
          stations: filtered.slice(0, limit),
          total: raw.length,
        }

        writeResultCache(SEARCH_STORAGE_KEY, key, result)
        return result
      } catch (err) {
        console.error('[radio] searchByName failed', err)
        this.lastError = err instanceof Error ? err.message : 'Неизвестная ошибка'

        if (cached) {
          this.isStale = true
          console.warn('[radio] search failed, using stale cache')
          return cached.data
        }

        return { stations: [], total: 0 }
      }
    })().finally(() => {
      this.searchInFlight.delete(key)
    })

    this.searchInFlight.set(key, promise)
    return promise
  }

  async getTopStations(
    limit = 20,
    offset = 0,
    order: RadioSortOrder = 'clickCount',
    countryCode?: string,
    tags: string[] = [],
  ): Promise<TopStationsResult> {
    const options: SearchStationsOptions = { countryCode, tags, order }
    const key = this.buildKey('top', '', limit, offset, options)

    this.isStale = false
    this.lastError = null

    const cached = readResultCache(TOP_STORAGE_KEY, key)

    if (cached?.fresh) {
      if (import.meta.env.DEV) console.debug('[radio] top HIT (fresh)', key)
      return cached.data
    }

    const inFlight = this.topInFlight.get(key)
    if (inFlight) return inFlight

    if (import.meta.env.DEV) {
      console.debug('[radio] top MISS', key, cached ? '(stale, refreshing)' : '(no cache)')
    }

    const promise = (async () => {
      const rawLimit = limit * 3

      try {
        const query: Record<string, unknown> = {
          limit: rawLimit,
          offset,
          hideBroken: true,
          order,
          reverse: order !== 'name',
        }

        if (countryCode) query.countryCode = countryCode
        if (tags.length > 0) query.tagList = tags

        const raw = await this.api.searchStations(query)
        const filtered = this.filterAndMap(raw)

        const result: TopStationsResult = {
          stations: filtered.slice(0, limit),
          total: raw.length,
        }

        writeResultCache(TOP_STORAGE_KEY, key, result)
        return result
      } catch (err) {
        console.error('[radio] getTopStations failed', err)
        this.lastError = err instanceof Error ? err.message : 'Неизвестная ошибка'

        if (cached) {
          this.isStale = true
          console.warn('[radio] top failed, using stale cache')
          return cached.data
        }

        return { stations: [], total: 0 }
      }
    })().finally(() => {
      this.topInFlight.delete(key)
    })

    this.topInFlight.set(key, promise)
    return promise
  }

  clearCache(): void {
    try {
      localStorage.removeItem(TOP_STORAGE_KEY)
      localStorage.removeItem(SEARCH_STORAGE_KEY)
    } catch {
      // ignore
    }
  }

  private buildKey(
    kind: 'top' | 'search',
    name: string,
    limit: number,
    offset: number,
    options: SearchStationsOptions,
  ): string {
    const normalized = name.trim().toLowerCase()
    const country = options.countryCode ?? ''
    const order = options.order ?? ''
    const tags = (options.tags ?? [])
      .map((t) => t.toLowerCase())
      .sort()
      .join(',')
    return `${kind}|${normalized}|${limit}|${offset}|${order}|${country}|${tags}`
  }

  private filterAndMap(stations: Station[]): RadioStation[] {
    return stations
      .filter((station) => Boolean(station.urlResolved?.startsWith('https://')))
      .map((station) => ({
        id: station.id,
        name: station.name.trim(),
        url: station.urlResolved,
        favicon: station.favicon || '',
        tags: station.tags || [],
        country: station.country || '',
        bitrate: station.bitrate || 0,
      }))
  }
}

export const radioService = RadioService.getInstance()
