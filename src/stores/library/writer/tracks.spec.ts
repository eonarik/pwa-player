// src/stores/library/writer/tracks.spec.ts

import { beforeEach, describe, expect, it } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

import { useLibraryStore } from '../store';
import { createLibraryWriter } from './index';
import { newFolderId, newTrackId, newTrackSourceId, type FolderId } from '@/types/ids';
import type { FolderRef } from '@/types/folder';
import type { Track, TrackSource } from '@/types/track';

function makeFolder(overrides: Partial<FolderRef> = {}): FolderRef {
  return {
    id: newFolderId(),
    pluginId: 'local',
    name: 'Folder',
    parentId: null,
    urlPath: '',
    trackIds: [],
    scanState: 'scanned',
    scanStateUpdatedAt: 0,
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

function makeTrack(sources: TrackSource[]): Track {
  return {
    id: newTrackId(),
    pluginId: sources[0]?.pluginId ?? '',
    artist: 'Artist',
    title: 'Title',
    albumId: null,
    coverUrl: null,
    sources,
    metadataCandidates: [],
    raw: null,
    hasId3Tags: false,
  };
}

describe('addTracks: пакетная привязка к папкам', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('кладёт id трека в trackIds папки из локального source', async () => {
    const library = useLibraryStore();
    const folder = makeFolder();
    library.folders[folder.id] = folder;
    const track = makeTrack([localSource(folder.id)]);

    await createLibraryWriter().addTracks([track], '');

    expect(library.getFolder(folder.id)?.trackIds).toEqual([track.id]);
  });

  it('привязывает трек к каждой папке из локального и облачного source', async () => {
    const library = useLibraryStore();
    const localFolder = makeFolder();
    const cloudFolder = makeFolder({ pluginId: 'yandex' });
    library.folders[localFolder.id] = localFolder;
    library.folders[cloudFolder.id] = cloudFolder;

    const track = makeTrack([localSource(localFolder.id), cloudSource(cloudFolder.id)]);

    await createLibraryWriter().addTracks([track], '');

    expect(library.getFolder(localFolder.id)?.trackIds).toEqual([track.id]);
    expect(library.getFolder(cloudFolder.id)?.trackIds).toEqual([track.id]);
  });

  it('не дублирует id, если трек уже в trackIds, и не теряет прежние id', async () => {
    const library = useLibraryStore();
    const existing = makeTrack([localSource(newFolderId())]);
    const folder = makeFolder({ trackIds: [existing.id] });
    library.folders[folder.id] = folder;
    library.tracks[existing.id] = existing;

    const fresh = makeTrack([localSource(folder.id)]);
    const again = makeTrack([localSource(folder.id), localSource(folder.id)]);

    await createLibraryWriter().addTracks([fresh, again], '');

    const ids = library.getFolder(folder.id)?.trackIds ?? [];
    expect(ids).toEqual([existing.id, fresh.id, again.id]);
  });

  it('игнорирует streaming-source и source с неизвестной папкой', async () => {
    const library = useLibraryStore();
    const folder = makeFolder();
    library.folders[folder.id] = folder;

    const unknownFolderId = newFolderId();
    const track = makeTrack([streamingSource(), localSource(unknownFolderId)]);

    await createLibraryWriter().addTracks([track], '');

    expect(library.getFolder(folder.id)?.trackIds).toEqual([]);
    expect(library.tracks[track.id]).toBeDefined();
  });

  it('обрабатывает пакет из 2000 треков без дублей', async () => {
    const library = useLibraryStore();
    const folder = makeFolder();
    library.folders[folder.id] = folder;

    const tracks = Array.from({ length: 2000 }, () => makeTrack([localSource(folder.id)]));

    await createLibraryWriter().addTracks(tracks, '');

    const ids = library.getFolder(folder.id)?.trackIds ?? [];
    expect(ids).toHaveLength(2000);
    expect(new Set(ids).size).toBe(2000);
  });

  it('removeTrack снимает трек из всех его папок', async () => {
    const library = useLibraryStore();
    const localFolder = makeFolder();
    const cloudFolder = makeFolder({ pluginId: 'yandex' });
    library.folders[localFolder.id] = localFolder;
    library.folders[cloudFolder.id] = cloudFolder;

    const track = makeTrack([localSource(localFolder.id), cloudSource(cloudFolder.id)]);
    await createLibraryWriter().addTracks([track], '');

    await createLibraryWriter().removeTrack(track.id);

    expect(library.getFolder(localFolder.id)?.trackIds).toEqual([]);
    expect(library.getFolder(cloudFolder.id)?.trackIds).toEqual([]);
  });
});
