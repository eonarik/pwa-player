// src/stores/library/store/reconcile.spec.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useLibraryStore } from '../index';
import { asTrackSourceId, newFolderId, newTrackId, newTrackSourceId, type FolderId } from '@/types/ids';
import type { FolderRef } from '@/types/folder';
import type { Track, TrackSource } from '@/types/track';

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

function localSource(folderId: FolderId): TrackSource {
  return {
    id: newTrackSourceId(),
    pluginId: 'local',
    priority: 10,
    kind: 'local',
    handle: {} as FileSystemFileHandle,
    folderId,
  };
}

function cloudSource(folderId: FolderId): TrackSource {
  return {
    id: newTrackSourceId(),
    pluginId: 'yandex',
    priority: 20,
    kind: 'cloud',
    remotePath: 'Music/song.mp3',
    folderId,
  };
}

function streamingSource(): TrackSource {
  return { id: newTrackSourceId(), pluginId: 'zvuk', priority: 30, kind: 'streaming', url: '/api/stream' };
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
          id: asTrackSourceId('src-1'),
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
          id: asTrackSourceId('src-1'),
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
          id: asTrackSourceId('src-1'),
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

  it('привязывает трек к каждой папке, где у него есть source', () => {
    const library = useLibraryStore();
    const localFolder = makeFolder();
    const cloudFolder = makeFolder({ pluginId: 'yandex' });
    library.folders[localFolder.id] = localFolder;
    library.folders[cloudFolder.id] = cloudFolder;

    const track = makeTrack({ sources: [localSource(localFolder.id), cloudSource(cloudFolder.id)] });
    library.tracks[track.id] = track;

    library.reconcileFolderTrackIds();

    expect(library.getFolder(localFolder.id)?.trackIds).toEqual([track.id]);
    expect(library.getFolder(cloudFolder.id)?.trackIds).toEqual([track.id]);
  });

  it('не дублирует трек в папке при двух sources одной папки', () => {
    const library = useLibraryStore();
    const folder = makeFolder();
    library.folders[folder.id] = folder;

    const track = makeTrack({ sources: [localSource(folder.id), cloudSource(folder.id)] });
    library.tracks[track.id] = track;

    library.reconcileFolderTrackIds();

    expect(library.getFolder(folder.id)?.trackIds).toEqual([track.id]);
  });

  it('игнорирует streaming-source', () => {
    const library = useLibraryStore();
    const folder = makeFolder();
    library.folders[folder.id] = folder;

    const track = makeTrack({ sources: [streamingSource()] });
    library.tracks[track.id] = track;

    library.reconcileFolderTrackIds();

    expect(library.getFolder(folder.id)?.trackIds).toEqual([]);
  });

  it('чинит заранее неверный порядок trackIds', () => {
    const library = useLibraryStore();
    const folder = makeFolder();
    library.folders[folder.id] = folder;

    const first = makeTrack({ sources: [localSource(folder.id)] });
    const second = makeTrack({ sources: [localSource(folder.id)] });
    library.tracks[first.id] = first;
    library.tracks[second.id] = second;

    folder.trackIds = [second.id, first.id];

    library.reconcileFolderTrackIds();

    expect(library.getFolder(folder.id)?.trackIds).toEqual([first.id, second.id]);
  });
});
