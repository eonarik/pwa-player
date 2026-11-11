// src/plugins/radio/browser/api.spec.ts

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  COUNTRIES_STORAGE_KEY,
  countriesUrl,
  fetchJson,
  mapStation,
  readCache,
  stationsByTagUrl,
  stationsSearchUrl,
  tagsUrl,
  writeCache,
  type RawStation,
} from './api';
import type { RadioStationSearchQuery } from './types';

function rawStation(overrides: Partial<RawStation> = {}): RawStation {
  return {
    stationuuid: 'uuid-1',
    name: 'Test Radio',
    url: 'http://test/stream',
    url_resolved: 'https://test/stream',
    favicon: 'https://test/icon.png',
    tags: 'rock,  pop ,',
    country: 'Russia',
    bitrate: 128,
    ...overrides,
  };
}

describe('url builders', () => {
  it('countriesUrl/tagsUrl point at the documented endpoints', () => {
    expect(countriesUrl()).toContain('/json/countries');
    expect(tagsUrl(30)).toContain('/json/tags');
    expect(tagsUrl(30)).toContain('limit=30');
    expect(tagsUrl(30)).toContain('order=stationcount');
  });

  it('stationsSearchUrl serializes only provided params', () => {
    const query: RadioStationSearchQuery = {
      name: 'rock',
      limit: 10,
      offset: 20,
      order: 'votes',
      countryCode: 'RU',
      tagList: ['rock', 'hits'],
    };
    const url = stationsSearchUrl(query);

    expect(url).toContain('/json/stations/search');
    expect(url).toContain('name=rock');
    expect(url).toContain('limit=10');
    expect(url).toContain('offset=20');
    expect(url).toContain('order=votes');
    expect(url).toContain('countrycode=RU');
    expect(url).toContain('tagList=rock%2Chits');
    // hideBroken по умолчанию true
    expect(url).toContain('hidebroken=true');
  });

  it('stationsSearchUrl omits empty tagList and allows hiding hidebroken', () => {
    const url = stationsSearchUrl({ tagList: [], hideBroken: false });
    expect(url).not.toContain('tagList=');
    expect(url).not.toContain('hidebroken=');
  });

  it('stationsByTagUrl encodes the tag', () => {
    const url = stationsByTagUrl('world hit', 5, true);
    expect(url).toContain('/json/stations/bytag/world%20hit');
    expect(url).toContain('limit=5');
    expect(url).toContain('hidebroken=true');
  });
});

describe('mapStation', () => {
  it('prefers url_resolved and splits tags', () => {
    const station = mapStation(rawStation());
    expect(station).toEqual({
      id: 'uuid-1',
      name: 'Test Radio',
      url: 'https://test/stream',
      favicon: 'https://test/icon.png',
      tags: ['rock', 'pop'],
      country: 'Russia',
      bitrate: 128,
    });
  });

  it('falls back to url when url_resolved is empty', () => {
    expect(mapStation(rawStation({ url_resolved: '' })).url).toBe('http://test/stream');
  });

  it('yields empty url when both are empty', () => {
    expect(mapStation(rawStation({ url: '', url_resolved: '' })).url).toBe('');
  });
});

describe('localStorage cache helpers', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('readCache reports fresh entry with its age', () => {
    writeCache('k', [1, 2]);
    const read = readCache<number[]>('k', 1000);
    expect(read).not.toBeNull();
    expect(read?.data).toEqual([1, 2]);
    expect(read?.fresh).toBe(true);
  });

  it('readCache reports stale entry instead of dropping it', () => {
    localStorage.setItem('k', JSON.stringify({ data: [1], fetchedAt: Date.now() - 5000 }));
    const read = readCache<number[]>('k', 1000);
    expect(read?.fresh).toBe(false);
    expect(read?.age).toBeGreaterThanOrEqual(5000);
    expect(read?.data).toEqual([1]);
  });

  it('readCache returns null for missing, malformed or foreign payload', () => {
    expect(readCache('absent', 1000)).toBeNull();

    localStorage.setItem('broken', '{not json');
    expect(readCache('broken', 1000)).toBeNull();

    localStorage.setItem('no-ts', JSON.stringify({ data: [] }));
    expect(readCache('no-ts', 1000)).toBeNull();
  });

  it('writeCache swallows storage failures (quota, private mode)', () => {
    const original = localStorage.setItem.bind(localStorage);
    localStorage.setItem = () => {
      throw new Error('QuotaExceededError');
    };

    expect(() => writeCache(COUNTRIES_STORAGE_KEY, [])).not.toThrow();

    localStorage.setItem = original;
  });
});

describe('fetchJson', () => {
  const url = 'https://api.test/json/countries';

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns parsed body for json responses', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify([{ name: 'RU' }]), {
        headers: { 'content-type': 'application/json' },
      }),
    );

    expect(await fetchJson<Array<{ name: string }>>(url)).toEqual([{ name: 'RU' }]);
  });

  it('returns null for non-2xx without reading the body as json', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('{"error":"nope"}', { status: 503, headers: { 'content-type': 'application/json' } }),
    );

    expect(await fetchJson(url)).toBeNull();
  });

  it('returns null when the server answers with html', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('<html>gateway</html>', { headers: { 'content-type': 'text/html' } }),
    );

    expect(await fetchJson(url)).toBeNull();
  });

  it('returns null on network error', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'));

    expect(await fetchJson(url)).toBeNull();
  });
});
