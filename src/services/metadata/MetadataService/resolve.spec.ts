// src/services/metadata/MetadataService/resolve.spec.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { createMetadataResolve } from './resolve';
import { useUiSettingsStore } from '@/stores/uiSettings';

// Мокаем registry: getPlugins и loadPlugin.
const mockPlugins = new Map<string, { id: string; name: string; metadataPriority?: number }>();
const mockFetchMetadata = new Map<string, (artist: string, title: string) => Promise<unknown>>();

vi.mock('@/plugins/registry', () => ({
  getPlugins: () => Array.from(mockPlugins.values()),
  loadPlugin: vi.fn(async (id: string) => {
    const fetcher = mockFetchMetadata.get(id);
    return {
      id,
      fetchMetadata: fetcher ? async (artist: string, title: string) => fetcher(artist, title) : undefined,
    };
  }),
}));

// Мокаем TrackMetadataService.
const mockItunesResult = vi.fn();
const mockDeezerResult = vi.fn();

vi.mock('../TrackMetadataService', () => ({
  trackMetadataService: {
    fetchItunes: (...args: unknown[]) => mockItunesResult(...args),
    fetchDeezer: (...args: unknown[]) => mockDeezerResult(...args),
  },
}));

function setOrder(order: string[]): void {
  const ui = useUiSettingsStore();
  ui.setMetadataProviderOrder(order);
}

describe('createMetadataResolve', () => {
  let resolve: ReturnType<typeof createMetadataResolve>;

  beforeEach(() => {
    setActivePinia(createPinia());
    mockPlugins.clear();
    mockFetchMetadata.clear();
    mockItunesResult.mockReset();
    mockDeezerResult.mockReset();
    resolve = createMetadataResolve();
  });

  describe('Пустой порядок', () => {
    it('sequential: [] → not-found без вызовов', async () => {
      setOrder([]);
      const result = await resolve.resolveCandidates('A', 'T', 'sequential', 0.75);
      expect(result).toEqual({ status: 'not-found' });
      expect(mockItunesResult).not.toHaveBeenCalled();
      expect(mockDeezerResult).not.toHaveBeenCalled();
    });

    it('parallel: [] → not-found без вызовов', async () => {
      setOrder([]);
      const result = await resolve.resolveCandidates('A', 'T', 'parallel', 0.75);
      expect(result).toEqual({ status: 'not-found' });
      expect(mockItunesResult).not.toHaveBeenCalled();
      expect(mockDeezerResult).not.toHaveBeenCalled();
    });
  });

  describe('Один built-in провайдер', () => {
    it('sequential: только iTunes, Deezer не вызывается', async () => {
      setOrder(['itunes']);
      mockItunesResult.mockResolvedValue({
        status: 'found',
        data: {
          artist: 'A',
          title: 'T',
          album: 'Al',
          coverUrl: null,
          source: 'itunes',
          similarity: 0.95,
          confident: true,
        },
      });

      const result = await resolve.resolveCandidates('A', 'T', 'sequential', 0.75);

      expect(result.status).toBe('confident');
      expect(mockItunesResult).toHaveBeenCalledTimes(1);
      expect(mockDeezerResult).not.toHaveBeenCalled();
    });
  });

  describe('Два built-in провайдера', () => {
    it('sequential: iTunes confident → Deezer не вызывается', async () => {
      setOrder(['itunes', 'deezer']);
      mockItunesResult.mockResolvedValue({
        status: 'found',
        data: {
          artist: 'A',
          title: 'T',
          album: 'Al',
          coverUrl: null,
          source: 'itunes',
          similarity: 0.95,
          confident: true,
        },
      });

      const result = await resolve.resolveCandidates('A', 'T', 'sequential', 0.75);

      expect(result.status).toBe('confident');
      expect(mockItunesResult).toHaveBeenCalledTimes(1);
      expect(mockDeezerResult).not.toHaveBeenCalled();
    });

    it('sequential: iTunes not-found → Deezer вызывается', async () => {
      setOrder(['itunes', 'deezer']);
      mockItunesResult.mockResolvedValue({ status: 'not-found' });
      mockDeezerResult.mockResolvedValue({
        status: 'found',
        data: {
          artist: 'A',
          title: 'T',
          album: 'Al',
          coverUrl: null,
          source: 'deezer',
          similarity: 0.9,
          confident: true,
        },
      });

      const result = await resolve.resolveCandidates('A', 'T', 'sequential', 0.75);

      expect(result.status).toBe('confident');
      expect(mockItunesResult).toHaveBeenCalledTimes(1);
      expect(mockDeezerResult).toHaveBeenCalledTimes(1);
    });

    it('sequential: оба not-found → not-found', async () => {
      setOrder(['itunes', 'deezer']);
      mockItunesResult.mockResolvedValue({ status: 'not-found' });
      mockDeezerResult.mockResolvedValue({ status: 'not-found' });

      const result = await resolve.resolveCandidates('A', 'T', 'sequential', 0.75);

      expect(result).toEqual({ status: 'not-found' });
    });

    it('sequential: iTunes error → не блокирует Deezer', async () => {
      setOrder(['itunes', 'deezer']);
      mockItunesResult.mockResolvedValue({ status: 'error', message: 'iTunes failed' });
      mockDeezerResult.mockResolvedValue({
        status: 'found',
        data: {
          artist: 'A',
          title: 'T',
          album: 'Al',
          coverUrl: null,
          source: 'deezer',
          similarity: 0.9,
          confident: true,
        },
      });

      const result = await resolve.resolveCandidates('A', 'T', 'sequential', 0.75);

      expect(result.status).toBe('confident');
      expect(mockDeezerResult).toHaveBeenCalledTimes(1);
    });
  });

  describe('Плагин провайдер (zvuk)', () => {
    beforeEach(() => {
      mockPlugins.set('zvuk', { id: 'zvuk', name: 'СберЗвук', metadataPriority: 30 });
    });

    it('sequential: Zvuk confident → iTunes не вызывается', async () => {
      setOrder(['zvuk', 'itunes']);
      mockFetchMetadata.set('zvuk', async () => ({
        artist: 'A',
        title: 'T',
        album: 'Al',
        coverUrl: null,
        source: 'zvuk',
        similarity: 1.0,
        confident: true,
        extMetadata: { trackId: 'zvuk-1' },
      }));

      const result = await resolve.resolveCandidates('A', 'T', 'sequential', 0.75);

      expect(result.status).toBe('confident');
      expect(mockItunesResult).not.toHaveBeenCalled();
    });

    it('sequential: Zvuk not-found → идёт к iTunes', async () => {
      setOrder(['zvuk', 'itunes']);
      mockFetchMetadata.set('zvuk', async () => null);
      mockItunesResult.mockResolvedValue({
        status: 'found',
        data: {
          artist: 'A',
          title: 'T',
          album: 'Al',
          coverUrl: null,
          source: 'itunes',
          similarity: 0.9,
          confident: true,
        },
      });

      const result = await resolve.resolveCandidates('A', 'T', 'sequential', 0.75);

      expect(result.status).toBe('confident');
      expect(mockItunesResult).toHaveBeenCalledTimes(1);
    });

    it('sequential: Zvuk error → идёт к iTunes', async () => {
      setOrder(['zvuk', 'itunes']);
      mockFetchMetadata.set('zvuk', async () => {
        throw new Error('Zvuk failed');
      });
      mockItunesResult.mockResolvedValue({
        status: 'found',
        data: {
          artist: 'A',
          title: 'T',
          album: 'Al',
          coverUrl: null,
          source: 'itunes',
          similarity: 0.9,
          confident: true,
        },
      });

      const result = await resolve.resolveCandidates('A', 'T', 'sequential', 0.75);

      expect(result.status).toBe('confident');
    });

    it('sequential: Zvuk не в getPlugins (удалён) → пропускается без вызова loadPlugin', async () => {
      mockPlugins.delete('zvuk');
      setOrder(['zvuk', 'itunes']);
      mockItunesResult.mockResolvedValue({ status: 'not-found' });

      const result = await resolve.resolveCandidates('A', 'T', 'sequential', 0.75);

      expect(result).toEqual({ status: 'not-found' });
    });

    it('parallel: Zvuk и iTunes вызываются параллельно', async () => {
      setOrder(['zvuk', 'itunes']);
      const order: string[] = [];

      mockFetchMetadata.set('zvuk', async () => {
        order.push('zvuk-start');
        await new Promise((r) => setTimeout(r, 10));
        order.push('zvuk-end');
        return null;
      });
      mockItunesResult.mockImplementation(async () => {
        order.push('itunes-start');
        await new Promise((r) => setTimeout(r, 10));
        order.push('itunes-end');
        return { status: 'not-found' };
      });

      await resolve.resolveCandidates('A', 'T', 'parallel', 0.75);

      expect(order.slice(0, 2).sort()).toEqual(['itunes-start', 'zvuk-start']);
    });
  });

  describe('Candidates', () => {
    it('sequential: никто не confident → массив candidates', async () => {
      setOrder(['itunes', 'deezer']);
      mockItunesResult.mockResolvedValue({
        status: 'found',
        data: {
          artist: 'A',
          title: 'T',
          album: 'Al',
          coverUrl: null,
          source: 'itunes',
          similarity: 0.8,
          confident: false,
        },
      });
      mockDeezerResult.mockResolvedValue({
        status: 'found',
        data: {
          artist: 'A',
          title: 'T',
          album: 'Al',
          coverUrl: null,
          source: 'deezer',
          similarity: 0.7,
          confident: false,
        },
      });

      const result = await resolve.resolveCandidates('A', 'T', 'sequential', 0.75);

      const candidates = result.status === 'candidates' ? result.candidates : null;
      expect(candidates).not.toBeNull();
      expect(candidates).toHaveLength(1);
      expect(candidates![0]!.provider).toBe('itunes');
    });
  });
});
