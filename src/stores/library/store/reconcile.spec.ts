// src/stores/library/store/reconcile.spec.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useLibraryStore } from '../index';
import { newFolderId, newTrackId } from '@/types/ids';
import type { FolderRef } from '@/types/folder';
import type { Track } from '@/types/track';

function makeTrack(overrides: Partial<Track> = {}): Track {
  return {
    id: newTrackId(),
    pluginId: 'local',
    artist: 'Artist A',
    title: 'Track 1',
    albumId: null,
    coverUrl: null,
    sources: [],
    metadataCandidates: [],
    raw: null,
    hasId3Tags: true,
    ...overrides,
  };
}

function makeFolder(overrides: Partial<FolderRef> = {}): FolderRef {
  return {
    id: newFolderId(),
    pluginId: 'local',
    name: 'Folder',
    parentId: null,
    urlPath: '',
    trackIds: [],
    scanState: 'scanned',
    scanStateUpdatedAt: Date.now(),
    ...overrides,
  };
}

describe('reconcileFolderTrackIds', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('добавляет трек в folder.trackIds, если у него есть source с этим folderId', () => {
    const library = useLibraryStore();
    const folder = makeFolder();

    library.folders[folder.id] = folder;

    const track = makeTrack({
      sources: [
        {
          id: 'src-1' as never,
          pluginId: 'local',
          priority: 10,
          kind: 'local',
          handle: {} as FileSystemFileHandle,
          folderId: folder.id,
        },
      ],
    });
    library.tracks[track.id] = track;

    library.reconcileFolderTrackIds();

    expect(library.getFolder(folder.id)?.trackIds).toContain(track.id);
  });

  it('удаляет трек из folder.trackIds, если у него нет source с этим folderId', () => {
    const library = useLibraryStore();
    const folder = makeFolder();
    const track = makeTrack(); // sources пусты

    library.folders[folder.id] = folder;
    library.tracks[track.id] = track;

    // Симулируем рассинхрон: folder.trackIds содержит трек, но у него нет source
    folder.trackIds = [track.id];

    library.reconcileFolderTrackIds();

    expect(library.getFolder(folder.id)?.trackIds).not.toContain(track.id);
  });

  it('удаляет source с несуществующим folderId', () => {
    const library = useLibraryStore();
    const fakeFolderId = newFolderId(); // нет в folders

    const track = makeTrack({
      sources: [
        {
          id: 'src-1' as never,
          pluginId: 'local',
          priority: 10,
          kind: 'local',
          handle: {} as FileSystemFileHandle,
          folderId: fakeFolderId,
        },
      ],
    });
    library.tracks[track.id] = track;

    library.reconcileFolderTrackIds();

    expect(library.getTrack(track.id)?.sources).toHaveLength(0);
  });

  it('идемпотентен (повторный вызов не меняет ничего)', () => {
    const library = useLibraryStore();
    const folder = makeFolder();
    const track = makeTrack({
      sources: [
        {
          id: 'src-1' as never,
          pluginId: 'local',
          priority: 10,
          kind: 'local',
          handle: {} as FileSystemFileHandle,
          folderId: folder.id,
        },
      ],
    });

    library.folders[folder.id] = folder;
    library.tracks[track.id] = track;

    library.reconcileFolderTrackIds();
    const firstState = JSON.stringify({ folders: library.folders, tracks: library.tracks });

    library.reconcileFolderTrackIds();
    const secondState = JSON.stringify({ folders: library.folders, tracks: library.tracks });

    expect(secondState).toBe(firstState);
  });
});
