// src/plugins/radio/browser/api.ts

import { logger } from '@/utils/logger';
import type { RadioStation, RadioStationSearchQuery } from './types';

const API_BASE = '/api/radio-browser';
const REQUEST_TIMEOUT_MS = 10_000;

/** «Свежий» TTL: до него — не обновляем. После — пробуем обновить. */
export const COUNTRIES_TTL_MS = 24 * 60 * 60 * 1000;
export const TAGS_TTL_MS = 24 * 60 * 60 * 1000;

export const COUNTRIES_STORAGE_KEY = 'radio:cache:countries';
export const TAGS_STORAGE_KEY = 'radio:cache:tags';

/** Домен API: только здесь, наружу отдаются типы из `types.ts`. */
interface RawCountry {
  name: string;
  iso_3166_1: string;
  stationcount: number;
}

interface RawTag {
  name: string;
  stationcount: number;
}

interface RawStation {
  stationuuid: string;
  name: string;
  url: string;
  url_resolved: string;
  favicon: string;
  tags: string;
  country: string;
  bitrate: number;
}

export type { RawCountry, RawStation, RawTag };

/** URL поиска станций по параметрам запроса. */
export function stationsSearchUrl(query: RadioStationSearchQuery): string {
  const params = new URLSearchParams();

  if (query.name) params.set('name', query.name);
  if (typeof query.limit === 'number') params.set('limit', String(query.limit));
  if (typeof query.offset === 'number') params.set('offset', String(query.offset));
  if (query.order) params.set('order', query.order);
  if (typeof query.reverse === 'boolean') params.set('reverse', String(query.reverse));
  if (query.countryCode) params.set('countrycode', query.countryCode);
  if (query.tagList && query.tagList.length > 0) params.set('tagList', query.tagList.join(','));
  if (query.hideBroken !== false) params.set('hidebroken', 'true');

  return `${API_BASE}/json/stations/search?${params.toString()}`;
}

/** URL списка стран. */
export function countriesUrl(): string {
  return `${API_BASE}/json/countries`;
}

/** URL списка тегов, отсортированного по числу станций. */
export function tagsUrl(limit: number): string {
  return `${API_BASE}/json/tags?hidebroken=true&order=stationcount&reverse=true&limit=${limit}`;
}

/** URL станций по тегу. */
export function stationsByTagUrl(tag: string, limit: number, hideBroken: boolean): string {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  if (hideBroken) params.set('hidebroken', 'true');

  return `${API_BASE}/json/stations/bytag/${encodeURIComponent(tag)}?${params.toString()}`;
}

/**
 * GET c ожиданием JSON. Возвращает null при любой проблеме (сеть, HTTP, content-type),
 * чтобы вызывающий мог откатиться на stale-кеш.
 */
export async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!res.ok) {
      logger.error('[radio-browser] HTTP', res.status, url);
      return null;
    }

    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      const text = await res.text();
      logger.error('[radio-browser] unexpected content-type', contentType, url, text.slice(0, 200));
      return null;
    }

    return (await res.json()) as T;
  } catch (err) {
    logger.error('[radio-browser] request failed', url, err);
    return null;
  }
}

/** Сырая станция → доменная. Пустой url — сигнал «такую станцию выбросить». */
export function mapStation(raw: RawStation): RadioStation {
  return {
    id: raw.stationuuid,
    name: (raw.name || '').trim(),
    url: raw.url_resolved || raw.url || '',
    favicon: raw.favicon || '',
    tags: raw.tags
      ? raw.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : [],
    country: raw.country || '',
    bitrate: raw.bitrate || 0,
  };
}

interface PersistedCache<T> {
  data: T;
  fetchedAt: number;
}

export interface CacheReadResult<T> {
  data: T;
  age: number;
  fresh: boolean;
}

/**
 * Чтение кеша из localStorage. Битый или чужой формат — null (не бросаем:
 * кеш это оптимизация, а не источник истины).
 */
export function readCache<T>(key: string, ttl: number): CacheReadResult<T> | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedCache<T>;
    if (!parsed || typeof parsed.fetchedAt !== 'number') return null;
    const age = Date.now() - parsed.fetchedAt;
    return { data: parsed.data, age, fresh: age < ttl };
  } catch {
    return null;
  }
}

export function writeCache<T>(key: string, data: T): void {
  try {
    const payload: PersistedCache<T> = { data, fetchedAt: Date.now() };
    localStorage.setItem(key, JSON.stringify(payload));
  } catch (err) {
    logger.warn('[radio-browser] failed to persist cache', key, err);
  }
}
