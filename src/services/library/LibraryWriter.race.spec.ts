// src/services/library/LibraryWriter.race.spec.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useLibraryStore, createLibraryWriter } from '@/stores/library';
import type { PluginSnapshot } from '@/types/plugin';

// Используем importOriginal, чтобы сохранить реальный pluginIdFromSource
vi.mock('@/plugins/registry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/plugins/registry')>();
  return {
    ...actual,
    loadPlugin: vi.fn().mockResolvedValue({}),
    getPlugins: vi.fn().mockReturnValue([]),
  };
});

describe('LibraryWriter: Race Condition (Альбомы)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('не должен создавать дубликаты альбомов при параллельном setLibrary', async () => {
    const writer = createLibraryWriter();
    const library = useLibraryStore();

    // Два одинаковых альбома, но с разными ID треков.
    const snapshot1: PluginSnapshot = {
      folders: [],
      tracks: [
        {
          artist: 'Исполнитель',
          title: 'Трек 1',
          album: 'Альбом',
          coverUrl: null,
          hasId3Tags: true,
          source: {
            pluginId: 'local',
            priority: 10,
            kind: 'local',
            handle: {} as FileSystemFileHandle,
            folderId: 'folder-1' as never,
          },
        },
      ],
    };

    const snapshot2: PluginSnapshot = {
      folders: [],
      tracks: [
        {
          artist: 'Исполнитель',
          title: 'Трек 2',
          album: 'Альбом',
          coverUrl: null,
          hasId3Tags: true,
          source: {
            pluginId: 'local',
            priority: 10,
            kind: 'local',
            handle: {} as FileSystemFileHandle,
            folderId: 'folder-1' as never,
          },
        },
      ],
    };

    const promise1 = writer.setLibrary(snapshot1, 'local');
    const promise2 = writer.setLibrary(snapshot2, 'local');

    await Promise.all([promise1, promise2]);

    const albums = Object.values(library.albums);
    expect(albums.length).toBe(1);

    const tracks = Object.values(library.tracks);
    // Трек 1 и Трек 2 — разные title, оба created.
    expect(tracks.length).toBe(2);

    const albumId = albums[0]!.id;
    expect(tracks.every((t) => t.albumId === albumId)).toBe(true);
  });
});
