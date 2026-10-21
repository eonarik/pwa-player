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
  /** Сырое количество до фильтрации — для hasMore */
  total: number
}

export interface SearchStationsOptions {
  countryCode?: string
  tags?: string[]
}

class RadioService {
  private static instance: RadioService | null = null
  private api: RadioBrowserApi

  private constructor() {
    this.api = new RadioBrowserApi('CUEI Media Player')
  }

  static getInstance(): RadioService {
    if (!RadioService.instance) {
      RadioService.instance = new RadioService()
    }
    return RadioService.instance
  }

  /**
   * Список стран (по алфавиту).
   * Возвращает null при ошибке, [] при пустом успешном ответе.
   */
  getCountries(): Promise<RadioCountry[] | null> {
    return radioBrowserClient.getCountries()
  }

  /**
   * Список популярных тегов (по алфавиту).
   * Возвращает null при ошибке, [] при пустом успешном ответе.
   */
  getTags(limit = 20): Promise<RadioTag[] | null> {
    return radioBrowserClient.getTags(limit)
  }

  /**
   * Ищет станции по тегу.
   */
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

  /**
   * Ищет станции по названию с учётом фильтров (страна, теги).
   */
  async searchByName(
    name: string,
    limit = 20,
    options: SearchStationsOptions = {},
  ): Promise<RadioStation[]> {
    try {
      const query: Record<string, unknown> = {
        name,
        limit,
        hideBroken: true,
      }

      if (options.countryCode) {
        query.countryCode = options.countryCode
      }

      if (options.tags && options.tags.length > 0) {
        query.tagList = options.tags
      }

      const stations = await this.api.searchStations(query)
      return this.filterAndMap(stations)
    } catch (err) {
      console.error('[radio] searchByName failed', err)
      return []
    }
  }

  /**
   * Получает топ станций с учетом сортировки, страны и тега.
   *
   * Запрашивает limit * 3, чтобы после HTTPS-фильтрации осталось достаточно.
   * total — сырое количество до фильтрации (для hasMore).
   */
  async getTopStations(
    limit = 20,
    offset = 0,
    order: RadioSortOrder = 'clickCount',
    countryCode?: string,
    tags: string[] = [],
  ): Promise<TopStationsResult> {
    const rawLimit = limit * 3

    try {
      const query: Record<string, unknown> = {
        limit: rawLimit,
        offset,
        hideBroken: true,
        order,
        reverse: order !== 'name',
      }

      if (countryCode) {
        query.countryCode = countryCode
      }

      if (tags.length > 0) {
        query.tagList = tags
      }

      const raw = await this.api.searchStations(query)
      const filtered = this.filterAndMap(raw)

      return {
        stations: filtered.slice(0, limit),
        total: raw.length,
      }
    } catch (err) {
      console.error('[radio] getTopStations failed', err)
      return { stations: [], total: 0 }
    }
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
