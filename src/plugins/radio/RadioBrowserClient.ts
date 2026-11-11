// src/plugins/radio/RadioBrowserClient.ts

import { logger } from '@/utils/logger';
import {
  COUNTRIES_STORAGE_KEY,
  COUNTRIES_TTL_MS,
  TAGS_STORAGE_KEY,
  TAGS_TTL_MS,
  countriesUrl,
  fetchJson,
  mapStation,
  readCache,
  stationsByTagUrl,
  stationsSearchUrl,
  tagsUrl,
  writeCache,
  type RawCountry,
  type RawStation,
  type RawTag,
} from './browser/api';
import type { RadioCountry, RadioStation, RadioStationSearchQuery, RadioTag } from './browser/types';

export type {
  RadioCountry,
  RadioSortOrder,
  RadioStation,
  RadioStationSearchQuery,
  RadioTag,
} from './browser/types';

/**
 * Клиент radio-browser.info.
 *
 * Отвечает за две вещи поверх HTTP (`browser/api.ts`):
 * - кеш стран/тегов с stale-fallback (просроченный кеш лучше пустоты при недоступном сервере);
 * - дедупликацию параллельных одинаковых запросов (in-flight map по URL).
 */
export class RadioBrowserClient {
  private static instance: RadioBrowserClient | null = null;

  private countriesInFlight: Promise<RadioCountry[] | null> | null = null;
  private tagsInFlight: Map<number, Promise<RadioTag[] | null>> = new Map();
  private stationsInFlight: Map<string, Promise<RadioStation[]>> = new Map();

  static getInstance(): RadioBrowserClient {
    if (!RadioBrowserClient.instance) {
      RadioBrowserClient.instance = new RadioBrowserClient();
    }
    return RadioBrowserClient.instance;
  }

  /**
   * Список стран. Логика:
   * - Свежий кеш (< 24 ч) — отдаём без запроса.
   * - Просроченный кеш — пробуем обновить; при ошибке отдаём старый.
   * - Нет кеша — запрос; при ошибке — null.
   */
  async getCountries(): Promise<RadioCountry[] | null> {
    const cached = readCache<RadioCountry[]>(COUNTRIES_STORAGE_KEY, COUNTRIES_TTL_MS);

    if (cached?.fresh) {
      if (import.meta.env.DEV) logger.debug('[radio-browser] countries HIT (fresh)');
      return cached.data;
    }

    if (this.countriesInFlight) return this.countriesInFlight;

    if (import.meta.env.DEV) {
      logger.debug('[radio-browser] countries MISS', cached ? '(stale, refreshing)' : '(no cache)');
    }

    this.countriesInFlight = (async () => {
      const data = await fetchJson<RawCountry[]>(countriesUrl());
      if (data === null) {
        if (cached) {
          logger.warn('[radio-browser] countries refresh failed, using stale cache');
          return cached.data;
        }
        return null;
      }

      if (!Array.isArray(data)) {
        logger.error('[radio-browser] countries: response is not an array');
        return cached?.data ?? null;
      }

      const mapped = data
        .filter((c) => Boolean(c.name))
        .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
        .map((c) => ({
          name: c.name,
          code: c.iso_3166_1,
          stationCount: c.stationcount ?? 0,
        }));

      writeCache(COUNTRIES_STORAGE_KEY, mapped);
      return mapped;
    })().finally(() => {
      this.countriesInFlight = null;
    });

    return this.countriesInFlight;
  }

  /**
   * Список тегов. Логика как у стран.
   */
  async getTags(limit = 20): Promise<RadioTag[] | null> {
    const key = `${TAGS_STORAGE_KEY}:${limit}`;
    const cached = readCache<RadioTag[]>(key, TAGS_TTL_MS);

    if (cached?.fresh) {
      if (import.meta.env.DEV) logger.debug('[radio-browser] tags HIT (fresh)', limit);
      return cached.data;
    }

    const inFlight = this.tagsInFlight.get(limit);
    if (inFlight) return inFlight;

    if (import.meta.env.DEV) {
      logger.debug('[radio-browser] tags MISS', limit, cached ? '(stale, refreshing)' : '(no cache)');
    }

    const promise = (async () => {
      const data = await fetchJson<RawTag[]>(tagsUrl(limit));

      if (data === null) {
        if (cached) {
          logger.warn('[radio-browser] tags refresh failed, using stale cache', limit);
          return cached.data;
        }
        return null;
      }

      if (!Array.isArray(data)) {
        logger.error('[radio-browser] tags: response is not an array');
        return cached?.data ?? null;
      }

      const mapped = data
        .filter((t) => Boolean(t.name))
        .map((t) => ({
          name: t.name,
          stationCount: t.stationcount ?? 0,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'ru'));

      writeCache(key, mapped);
      return mapped;
    })().finally(() => {
      this.tagsInFlight.delete(limit);
    });

    this.tagsInFlight.set(limit, promise);
    return promise;
  }

  /**
   * Поиск станций через /json/stations/search.
   * Поддерживает name, countryCode, tagList, order, limit, offset.
   *
   * Возвращает [] при ошибке сети (не null — вызывающий код ожидает массив).
   */
  async searchStations(query: RadioStationSearchQuery): Promise<RadioStation[]> {
    const url = stationsSearchUrl(query);
    if (import.meta.env.DEV) logger.debug('[radio-browser] stations search', url);
    return this.requestStations(url);
  }

  /** Станции по тегу через /json/stations/bytag/<tag>. */
  async getStationsByTag(
    tag: string,
    options: { limit?: number; hideBroken?: boolean } = {},
  ): Promise<RadioStation[]> {
    const limit = options.limit ?? 20;
    const hideBroken = options.hideBroken !== false;

    const url = stationsByTagUrl(tag, limit, hideBroken);
    if (import.meta.env.DEV) logger.debug('[radio-browser] stations bytag', tag, limit);
    return this.requestStations(url);
  }

  /**
   * Один и тот же URL не запрашивается дважды параллельно: повторный вызов
   * получает тот же промис. Ключ — сам URL, он детерминирован из параметров.
   */
  private requestStations(url: string): Promise<RadioStation[]> {
    const inFlight = this.stationsInFlight.get(url);
    if (inFlight) return inFlight;

    const promise = (async () => {
      const data = await fetchJson<RawStation[]>(url);
      if (data === null) return [];
      if (!Array.isArray(data)) {
        logger.error('[radio-browser] stations: response is not an array');
        return [];
      }
      return data
        .filter((s) => s && typeof s === 'object')
        .map(mapStation)
        .filter((s) => Boolean(s.url));
    })().finally(() => {
      this.stationsInFlight.delete(url);
    });

    this.stationsInFlight.set(url, promise);
    return promise;
  }

  clearCache(): void {
    try {
      localStorage.removeItem(COUNTRIES_STORAGE_KEY);
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith(TAGS_STORAGE_KEY)) localStorage.removeItem(key);
      }
    } catch {
      // ignore
    }
  }
}

export const radioBrowserClient = RadioBrowserClient.getInstance();
