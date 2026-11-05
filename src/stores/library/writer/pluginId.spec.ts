// src/stores/library/writer/pluginId.spec.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useLibraryStore } from '../store';
import { createLibraryWriter } from './index';
import type { Track } from '@/types/track';
import { newFolderId, newTrackId, newTrackSourceId } from '@/types/ids';

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
    hasId3Tags: false,
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

function makeStreamingSource(pluginId: string, url = '/api/stream') {
  return {
    id: newTrackSourceId(),
    pluginId,
    priority: 30,
    kind: 'streaming' as const,
    url,
  };
}

describe('ЦЕЛЕВОЕ ПОВЕДЕНИЕ: writer.addTracks нормализует pluginId', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('addTracks: pluginId совпадает с sources[0].pluginId', async () => {
    const library = useLibraryStore();
    const writer = createLibraryWriter();

    const track = makeTrack({
      pluginId: 'zvuk',
      sources: [makeStreamingSource('zvuk')],
    });

    await writer.addTracks([track], 'zvuk');

    expect(library.tracks[track.id]?.pluginId).toBe('zvuk');
  });

  it('addTracks: pluginId пересчитывается из sources[0], даже если расходится', async () => {
    const library = useLibraryStore();
    const writer = createLibraryWriter();

    const track = makeTrack({
      pluginId: 'imported',
      sources: [makeStreamingSource('zvuk')],
    });

    await writer.addTracks([track], 'zvuk');

    // Инвариант: pluginId следует за sources[0].pluginId.
    expect(library.tracks[track.id]?.pluginId).toBe('zvuk');
    expect(library.tracks[track.id]?.sources[0]?.pluginId).toBe('zvuk');
  });

  it('addTracks: пустые sources → pluginId = ""', async () => {
    const library = useLibraryStore();
    const writer = createLibraryWriter();

    const track = makeTrack({
      pluginId: 'imported',
      sources: [],
    });

    await writer.addTracks([track], 'imported');

    expect(library.tracks[track.id]?.pluginId).toBe('');
    expect(library.tracks[track.id]?.sources).toEqual([]);
  });

  it('addTracks: сортирует sources по priority и берёт pluginId из sources[0]', async () => {
    const library = useLibraryStore();
    const writer = createLibraryWriter();

    const track = makeTrack({
      pluginId: 'zvuk',
      // Намеренно в обратном порядке: streaming (30) → local (10)
      sources: [makeStreamingSource('zvuk'), makeLocalSource('local')],
    });

    await writer.addTracks([track], 'zvuk');

    const updated = library.tracks[track.id];
    expect(updated?.sources[0]?.kind).toBe('local');
    expect(updated?.sources[1]?.kind).toBe('streaming');
    expect(updated?.pluginId).toBe('local');
  });
});

describe('ЦЕЛЕВОЕ ПОВЕДЕНИЕ: writer.updateTrackSources нормализует pluginId', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('updateTrackSources: imported → zvuk, pluginId = "zvuk"', async () => {
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
    expect(updated?.sources[0]?.pluginId).toBe('zvuk');
    expect(updated?.pluginId).toBe('zvuk');
  });

  it('updateTrackSources: сортирует sources по priority и берёт pluginId из sources[0]', async () => {
    const library = useLibraryStore();
    const writer = createLibraryWriter();

    const trackId = newTrackId();
    library.tracks[trackId] = makeTrack({
      id: trackId,
      pluginId: 'zvuk',
      sources: [makeStreamingSource('zvuk')],
    });

    // Передаём в обратном порядке: streaming (30) → local (10) → cloud (20)
    await writer.updateTrackSources(trackId, [
      makeStreamingSource('zvuk'),
      makeCloudSource('yandex'),
      makeLocalSource('local'),
    ]);

    const updated = library.getTrack(trackId);
    expect(updated?.sources).toHaveLength(3);
    expect(updated?.sources[0]?.kind).toBe('local');
    expect(updated?.sources[1]?.kind).toBe('cloud');
    expect(updated?.sources[2]?.kind).toBe('streaming');
    expect(updated?.pluginId).toBe('local');
  });

  it('updateTrackSources: пустые sources → pluginId = ""', async () => {
    const library = useLibraryStore();
    const writer = createLibraryWriter();

    const trackId = newTrackId();
    library.tracks[trackId] = makeTrack({
      id: trackId,
      pluginId: 'imported',
      sources: [makeStreamingSource('imported', '')],
    });

    await writer.updateTrackSources(trackId, []);

    const updated = library.getTrack(trackId);
    expect(updated).not.toBeNull();
    expect(updated?.sources).toEqual([]);
    expect(updated?.pluginId).toBe('');
  });

  it('updateTrackSources: из local + zvuk убираем local → pluginId становится "zvuk"', async () => {
    const library = useLibraryStore();
    const writer = createLibraryWriter();

    const trackId = newTrackId();
    library.tracks[trackId] = makeTrack({
      id: trackId,
      pluginId: 'local',
      sources: [makeLocalSource('local'), makeStreamingSource('zvuk')],
    });

    // Симулируем removeDownloaded: убираем local, оставляем zvuk
    await writer.updateTrackSources(trackId, [makeStreamingSource('zvuk')]);

    const updated = library.getTrack(trackId);
    expect(updated?.sources).toHaveLength(1);
    expect(updated?.sources[0]?.kind).toBe('streaming');
    expect(updated?.pluginId).toBe('zvuk');
  });
});

describe('writer.removeTrack: не влияет на другие треки', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('removeTrack удаляет только указанный трек', async () => {
    const library = useLibraryStore();
    const writer = createLibraryWriter();

    const keepId = newTrackId();
    const removeId = newTrackId();
    library.tracks[keepId] = makeTrack({ id: keepId, pluginId: 'zvuk', sources: [makeStreamingSource('zvuk')] });
    library.tracks[removeId] = makeTrack({ id: removeId, pluginId: 'zvuk', sources: [makeStreamingSource('zvuk')] });

    await writer.removeTrack(removeId);

    expect(library.getTrack(removeId)).toBeNull();
    expect(library.getTrack(keepId)?.pluginId).toBe('zvuk');
  });
});
