// src/services/library/selectors.spec.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import {
  hasLocalSource,
  hasCloudSource,
  hasStreamingSource,
  isTrackMetadataModified,
  getPlayability,
} from './selectors';
import { useLibraryStore } from '@/stores/library';
import { createLibraryWriter } from '@/stores/library';
import { isStreamingPlugin } from '@/plugins/registry';
import type { Track } from '@/types/track';
import { newFolderId, newTrackId, newTrackSourceId } from '@/types/ids';

// Мокаем loadPlugin — иначе librarySaveService.scheduleSave полезет в registry.
vi.mock('@/plugins/registry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/plugins/registry')>();
  return {
    ...actual,
    loadPlugin: vi.fn().mockResolvedValue({ saveCache: vi.fn() }),
  };
});

function makeTrack(overrides: Partial<Track> = {}): Track {
  return {
    id: newTrackId(),
    pluginId: 'local',
    artist: 'Artist',
    title: 'Title',
    albumId: null,
    coverUrl: null,
    sources: [],
    metadataCandidates: [],
    raw: null,
    hasId3Tags: true,
    ...overrides,
  };
}

function makeLocalSource(pluginId = 'local') {
  return {
    id: newTrackSourceId(),
    pluginId,
    priority: 10,
    kind: 'local' as const,
    handle: {} as FileSystemFileHandle,
    folderId: newFolderId(),
  };
}

function makeCloudSource(pluginId = 'yandex') {
  return {
    id: newTrackSourceId(),
    pluginId,
    priority: 20,
    kind: 'cloud' as const,
    remotePath: 'Music/song.mp3',
    folderId: newFolderId(),
  };
}

function makeStreamingSource(pluginId = 'zvuk', url = '/api/zvuk/stream?id=1') {
  return {
    id: newTrackSourceId(),
    pluginId,
    priority: 30,
    kind: 'streaming' as const,
    url,
  };
}

describe('selectors: hasLocalSource / hasCloudSource / hasStreamingSource', () => {
  it('hasLocalSource — true при наличии local-source', () => {
    const track = makeTrack({ sources: [makeLocalSource()] });
    expect(hasLocalSource(track)).toBe(true);
    expect(hasCloudSource(track)).toBe(false);
    expect(hasStreamingSource(track)).toBe(false);
  });

  it('hasCloudSource — true при наличии cloud-source', () => {
    const track = makeTrack({ sources: [makeCloudSource()] });
    expect(hasLocalSource(track)).toBe(false);
    expect(hasCloudSource(track)).toBe(true);
    expect(hasStreamingSource(track)).toBe(false);
  });

  it('hasStreamingSource — true при наличии streaming-source', () => {
    const track = makeTrack({ sources: [makeStreamingSource()] });
    expect(hasLocalSource(track)).toBe(false);
    expect(hasCloudSource(track)).toBe(false);
    expect(hasStreamingSource(track)).toBe(true);
  });

  it('hasStreamingSource — false для пустого sources', () => {
    const track = makeTrack({ sources: [] });
    expect(hasStreamingSource(track)).toBe(false);
  });

  it('hasStreamingSource — false для null', () => {
    expect(hasStreamingSource(null)).toBe(false);
    expect(hasStreamingSource(undefined)).toBe(false);
  });

  it('мультиисточник: local + zvuk streaming', () => {
    const track = makeTrack({
      sources: [makeLocalSource(), makeStreamingSource()],
    });
    expect(hasLocalSource(track)).toBe(true);
    expect(hasStreamingSource(track)).toBe(true);
  });
});

describe('selectors: getPlayability', () => {
  it("'missing' для null", () => {
    expect(getPlayability(null, { isPluginDisconnected: false, isDownloading: false })).toBe('missing');
  });

  it("'missing' для пустого sources", () => {
    const track = makeTrack({ sources: [] });
    expect(getPlayability(track, { isPluginDisconnected: false, isDownloading: false })).toBe('missing');
  });

  it("'downloading' приоритетнее остальных", () => {
    const track = makeTrack({ sources: [makeCloudSource()] });
    expect(getPlayability(track, { isPluginDisconnected: false, isDownloading: true })).toBe('downloading');
  });

  it("'playable' при local-source", () => {
    const track = makeTrack({ sources: [makeLocalSource()] });
    expect(getPlayability(track, { isPluginDisconnected: false, isDownloading: false })).toBe('playable');
  });

  it("'needs-reconnect' при cloud-source и isPluginDisconnected", () => {
    const track = makeTrack({ sources: [makeCloudSource()] });
    expect(getPlayability(track, { isPluginDisconnected: true, isDownloading: false })).toBe('needs-reconnect');
  });

  it("'playable-streaming' при cloud-source без disconnect", () => {
    const track = makeTrack({ sources: [makeCloudSource()] });
    expect(getPlayability(track, { isPluginDisconnected: false, isDownloading: false })).toBe('playable-streaming');
  });

  it("'playable-streaming' при streaming-source", () => {
    const track = makeTrack({ sources: [makeStreamingSource()] });
    expect(getPlayability(track, { isPluginDisconnected: false, isDownloading: false })).toBe('playable-streaming');
  });
});

describe('selectors: isTrackMetadataModified', () => {
  it('false по умолчанию', () => {
    expect(isTrackMetadataModified(makeTrack())).toBe(false);
  });

  it('true для manual', () => {
    expect(isTrackMetadataModified(makeTrack({ metaSource: 'manual' }))).toBe(true);
  });

  it('true для auto', () => {
    expect(isTrackMetadataModified(makeTrack({ metaSource: 'auto' }))).toBe(true);
  });

  it('false для file/filename', () => {
    expect(isTrackMetadataModified(makeTrack({ metaSource: 'file' }))).toBe(false);
    expect(isTrackMetadataModified(makeTrack({ metaSource: 'filename' }))).toBe(false);
  });

  it('false для null', () => {
    expect(isTrackMetadataModified(null)).toBe(false);
  });
});

/**
 * ЦЕЛЕВОЕ ПОВЕДЕНИЕ (пункт 1 плана 0.16.2):
 *
 * После writer.updateTrackSources pluginId должен следовать за sources[0].pluginId
 * (при сортировке по priority).
 *
 * Проверяется через интеграцию с writer, а не на "голой" модели:
 * writer — единственная точка записи в library.tracks, и именно он
 * должен поддерживать инвариант pluginId === pluginIdFromSource(sources[0]).
 *
 * Если этот тест КРАСНЫЙ на текущем коде — баг подтверждён и требует фикса.
 */
describe('ЦЕЛЕВОЕ ПОВЕДЕНИЕ: pluginId следует за sources[0]', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('updateTrackSources импортированный трек → zvuk: pluginId становится "zvuk"', async () => {
    const library = useLibraryStore();
    const writer = createLibraryWriter();

    const trackId = newTrackId();
    library.tracks[trackId] = makeTrack({
      id: trackId,
      pluginId: 'imported',
      sources: [makeStreamingSource('imported', '')],
    });

    await writer.updateTrackSources(trackId, [makeStreamingSource('zvuk', '/api/zvuk/stream?id=1')]);

    const updated = library.getTrack(trackId);

    expect(updated?.sources).toHaveLength(1);
    expect(updated?.sources[0]?.pluginId).toBe('zvuk');
    expect(hasStreamingSource(updated)).toBe(true);

    // Инвариант: pluginId соответствует sources[0].pluginId.
    expect(updated?.pluginId).toBe('zvuk');
    expect(isStreamingPlugin(updated!.pluginId)).toBe(hasStreamingSource(updated));
  });

  it('updateTrackSources: local + zvuk streaming → pluginId остаётся "local"', async () => {
    const library = useLibraryStore();
    const writer = createLibraryWriter();

    const trackId = newTrackId();
    library.tracks[trackId] = makeTrack({
      id: trackId,
      pluginId: 'local',
      sources: [makeLocalSource('local')],
    });

    // Добавляем zvuk streaming (priority 30 > priority 10)
    await writer.updateTrackSources(trackId, [makeLocalSource('local'), makeStreamingSource('zvuk')]);

    const updated = library.getTrack(trackId);

    expect(hasLocalSource(updated)).toBe(true);
    expect(hasStreamingSource(updated)).toBe(true);

    // sources[0] = local (priority 10), значит pluginId = 'local'.
    expect(updated?.pluginId).toBe('local');
    expect(isStreamingPlugin(updated!.pluginId)).toBe(false);
  });
});
