// src/plugins/radio/browser/client.spec.ts

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RadioBrowserClient } from '../RadioBrowserClient';
import {
  COUNTRIES_STORAGE_KEY,
  COUNTRIES_TTL_MS,
  TAGS_STORAGE_KEY,
  readCache,
} from './api';
import type { RadioCountry } from './types';

function json(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    headers: { 'content-type': 'application/json' },
  });
}

/**
 * Каждый запрос должен получить СВЕЖИЙ Response: тело читается один раз,
 * поэтому mockResolvedValue с одним объектом не годится для нескольких вызовов.
 */
function respondWith(data: unknown): void {
  vi.mocked(fetch).mockImplementation(async () => json(data));
}

function seedCache(key: string, data: unknown, ageMs: number): void {
  localStorage.setItem(key, JSON.stringify({ data, fetchedAt: Date.now() - ageMs }));
}

const HOUR = 60 * 60 * 1000;

const RAW_COUNTRIES = [
  { name: 'Russia', iso_3166_1: 'RU', stationcount: 100 },
  { name: 'Belarus', iso_3166_1: 'BY', stationcount: 10 },
  { name: '', iso_3166_1: '??', stationcount: 1 },
];

const RAW_TAGS = [{ name: 'rock', stationcount: 500 }, { name: 'jazz', stationcount: 1 }];

const RAW_STATIONS = [
  {
    stationuuid: 's1',
    name: 'One',
    url: 'http://one',
    url_resolved: 'https://one/stream',
    favicon: '',
    tags: 'rock',
    country: 'RU',
    bitrate: 64,
  },
  // Станция без адреса — клиент обязан её отбросить.
  {
    stationuuid: 's2',
    name: 'Broken',
    url: '',
    url_resolved: '',
    favicon: '',
    tags: '',
    country: 'RU',
    bitrate: 0,
  },
];

let client: RadioBrowserClient;

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn());
  client = new RadioBrowserClient();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getCountries', () => {
  it('serves fresh cache without a request', async () => {
    seedCache(COUNTRIES_STORAGE_KEY, [{ name: 'Cached', code: 'C', stationCount: 1 }], HOUR);

    const result = await client.getCountries();

    expect(result).toEqual([{ name: 'Cached', code: 'C', stationCount: 1 }]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('maps, sorts by name and caches a successful response', async () => {
    respondWith(RAW_COUNTRIES);

    const result = await client.getCountries();

    expect(result).toEqual([
      { name: 'Belarus', code: 'BY', stationCount: 10 },
      { name: 'Russia', code: 'RU', stationCount: 100 },
    ]);
    const persisted = readCache<RadioCountry[]>(COUNTRIES_STORAGE_KEY, COUNTRIES_TTL_MS);
    expect(persisted?.data).toHaveLength(2);
    expect(persisted?.fresh).toBe(true);
  });

  it('falls back to stale cache when refresh fails', async () => {
    const stale = [{ name: 'Old', code: 'O', stationCount: 3 }];
    seedCache(COUNTRIES_STORAGE_KEY, stale, 25 * HOUR);
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'));

    expect(await client.getCountries()).toEqual(stale);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('returns null without cache when the request fails', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await client.getCountries()).toBeNull();
  });

  it('ignores a non-array payload', async () => {
    respondWith({ error: 'gateway' });
    expect(await client.getCountries()).toBeNull();
  });

  it('deduplicates parallel calls into a single request', async () => {
    respondWith(RAW_COUNTRIES);

    const [a, b] = await Promise.all([client.getCountries(), client.getCountries()]);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
  });
});

describe('getTags', () => {
  it('keys the cache by limit', async () => {
    respondWith(RAW_TAGS);

    await client.getTags(20);
    expect(localStorage.getItem(`${TAGS_STORAGE_KEY}:20`)).not.toBeNull();

    await client.getTags(5);
    expect(localStorage.getItem(`${TAGS_STORAGE_KEY}:5`)).not.toBeNull();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('deduplicates the same limit but not different ones', async () => {
    respondWith(RAW_TAGS);

    await Promise.all([client.getTags(20), client.getTags(20), client.getTags(10)]);

    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('keeps the stale list when the refresh fails', async () => {
    const stale = [{ name: 'old', stationCount: 1 }];
    seedCache(`${TAGS_STORAGE_KEY}:20`, stale, 25 * HOUR);
    vi.mocked(fetch).mockResolvedValue(new Response('nope', { status: 500 }));

    expect(await client.getTags()).toEqual(stale);
  });
});

describe('stations requests', () => {
  it('drops stations without an url', async () => {
    respondWith(RAW_STATIONS);

    const result = await client.searchStations({ name: 'one' });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('s1');
    expect(result[0]?.tags).toEqual(['rock']);
  });

  it('returns an empty array on network failure', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await client.searchStations({ name: 'x' })).toEqual([]);
  });

  it('deduplicates identical concurrent queries only', async () => {
    respondWith(RAW_STATIONS);

    await Promise.all([
      client.searchStations({ name: 'rock', limit: 10 }),
      client.searchStations({ name: 'rock', limit: 10 }),
      client.searchStations({ name: 'jazz', limit: 10 }),
    ]);
    expect(fetch).toHaveBeenCalledTimes(2);

    // Прошедший запрос не остаётся в in-flight-карте.
    await client.searchStations({ name: 'rock', limit: 10 });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('requests bytag endpoint honoring hideBroken', async () => {
    respondWith(RAW_STATIONS);

    await client.getStationsByTag('rock', { limit: 7, hideBroken: false });

    const url = vi.mocked(fetch).mock.calls[0]?.[0];
    expect(String(url)).toContain('/json/stations/bytag/rock');
    expect(String(url)).toContain('limit=7');
    expect(String(url)).not.toContain('hidebroken');
  });
});

describe('clearCache', () => {
  it('removes countries and every tags key, leaving unrelated storage alone', () => {
    seedCache(COUNTRIES_STORAGE_KEY, [], HOUR);
    seedCache(`${TAGS_STORAGE_KEY}:20`, [], HOUR);
    seedCache(`${TAGS_STORAGE_KEY}:5`, [], HOUR);
    localStorage.setItem('radio:cache:top', 'keep me');

    client.clearCache();

    expect(localStorage.getItem(COUNTRIES_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(`${TAGS_STORAGE_KEY}:20`)).toBeNull();
    expect(localStorage.getItem(`${TAGS_STORAGE_KEY}:5`)).toBeNull();
    expect(localStorage.getItem('radio:cache:top')).toBe('keep me');
  });
});
