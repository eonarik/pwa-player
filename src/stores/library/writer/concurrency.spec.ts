// src/stores/library/writer/concurrency.spec.ts (новый)

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useLibraryStore } from '../store';
import { createLibraryWriter } from './index';
import type { Track } from '@/types/track';
import { newTrackId, newTrackSourceId, newFolderId } from '@/types/ids';

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

describe('writer: concurrency', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('параллельные updateTrackSources на разных треках не теряют данные', async () => {
    const library = useLibraryStore();
    const writer = createLibraryWriter();

    const track1 = makeTrack({
      sources: [
        {
          id: newTrackSourceId(),
          pluginId: 'local',
          priority: 10,
          kind: 'local',
          handle: {} as FileSystemFileHandle,
          folderId: newFolderId(),
        },
      ],
    });
    const track2 = makeTrack({
      sources: [
        {
          id: newTrackSourceId(),
          pluginId: 'local',
          priority: 10,
          kind: 'local',
          handle: {} as FileSystemFileHandle,
          folderId: newFolderId(),
        },
      ],
    });

    library.tracks[track1.id] = track1;
    library.tracks[track2.id] = track2;

    await Promise.all([
      writer.updateTrackSources(track1.id, [
        {
          id: newTrackSourceId(),
          pluginId: 'zvuk',
          priority: 30,
          kind: 'streaming',
          url: '/zvuk1',
        },
      ]),
      writer.updateTrackSources(track2.id, [
        {
          id: newTrackSourceId(),
          pluginId: 'zvuk',
          priority: 30,
          kind: 'streaming',
          url: '/zvuk2',
        },
      ]),
    ]);

    expect(library.getTrack(track1.id)?.pluginId).toBe('zvuk');
    expect(library.getTrack(track2.id)?.pluginId).toBe('zvuk');
    expect(library.getTrack(track1.id)?.sources[0]?.kind).toBe('streaming');
    expect(library.getTrack(track2.id)?.sources[0]?.kind).toBe('streaming');
  });

  it('параллельные setLibrary не создают дубликатов альбомов', async () => {
    const writer = createLibraryWriter();
    const library = useLibraryStore();

    const snapshot1 = {
      folders: [],
      tracks: [
        {
          artist: 'A',
          title: 'T1',
          album: 'Al',
          coverUrl: null,
          hasId3Tags: false,
          source: {
            pluginId: 'local',
            priority: 10,
            kind: 'local' as const,
            handle: { name: 'file1.mp3' } as FileSystemFileHandle,
            folderId: newFolderId(),
          },
        },
      ],
    };
    const snapshot2 = {
      folders: [],
      tracks: [
        {
          artist: 'A',
          title: 'T2',
          album: 'Al',
          coverUrl: null,
          hasId3Tags: false,
          source: {
            pluginId: 'local',
            priority: 10,
            kind: 'local' as const,
            handle: { name: 'file2.mp3' } as FileSystemFileHandle,
            folderId: newFolderId(),
          },
        },
      ],
    };

    await Promise.all([writer.setLibrary(snapshot1, 'local'), writer.setLibrary(snapshot2, 'local')]);

    const albums = Object.values(library.albums);
    expect(albums.length).toBe(1);
    expect(Object.values(library.tracks).length).toBe(2);
  });
});
