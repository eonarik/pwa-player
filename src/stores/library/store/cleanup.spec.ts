// src/stores/library/store/cleanup.spec.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useLibraryStore, createLibraryWriter } from '../index';
import { newAlbumId, newFolderId, newTrackId } from '@/types/ids';
import type { Album } from '@/types/album';
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

function makeAlbum(overrides: Partial<Album> = {}): Album {
  return {
    id: newAlbumId(),
    name: 'Album',
    artist: 'Artist',
    coverUrl: null,
    ...overrides,
  };
}

describe('cleanupOrphanAlbums', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('удаляет пустой альбом (нет треков с этим albumId)', () => {
    const library = useLibraryStore();
    const writer = createLibraryWriter();
    const album = makeAlbum();

    writer.addOrUpdateAlbum(album);
    expect(library.getAlbum(album.id)).not.toBeNull();

    library.cleanupOrphanAlbums();

    expect(library.getAlbum(album.id)).toBeNull();
  });

  it('НЕ удаляет альбом, если к нему привязан хотя бы один трек', () => {
    const library = useLibraryStore();
    const writer = createLibraryWriter();
    const album = makeAlbum();
    const track = makeTrack({ albumId: album.id });

    writer.addOrUpdateAlbum(album);
    library.tracks[track.id] = track;

    library.cleanupOrphanAlbums();

    expect(library.getAlbum(album.id)).not.toBeNull();
  });

  it('удаляет только пустые, не трогает занятые', () => {
    const library = useLibraryStore();
    const writer = createLibraryWriter();

    const emptyAlbum = makeAlbum({ name: 'Empty' });
    const usedAlbum = makeAlbum({ name: 'Used' });
    const track = makeTrack({ albumId: usedAlbum.id });

    writer.addOrUpdateAlbum(emptyAlbum);
    writer.addOrUpdateAlbum(usedAlbum);
    library.tracks[track.id] = track;

    library.cleanupOrphanAlbums();

    expect(library.getAlbum(emptyAlbum.id)).toBeNull();
    expect(library.getAlbum(usedAlbum.id)).not.toBeNull();
  });
});

describe('cleanupOrphanTracks', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('удаляет трек без sources, если он нигде не используется', () => {
    const library = useLibraryStore();
    const track = makeTrack();

    library.tracks[track.id] = track;

    library.cleanupOrphanTracks({}, { playedAt: {} }, { dislikedAt: {} }, []);

    expect(library.getTrack(track.id)).toBeNull();
  });

  it('НЕ удаляет трек, если он в плейлисте', () => {
    const library = useLibraryStore();
    const track = makeTrack();

    library.tracks[track.id] = track;

    library.cleanupOrphanTracks({ p1: { trackIds: [track.id] } }, { playedAt: {} }, { dislikedAt: {} }, []);

    expect(library.getTrack(track.id)).not.toBeNull();
  });

  it('НЕ удаляет трек, если он в истории', () => {
    const library = useLibraryStore();
    const track = makeTrack();

    library.tracks[track.id] = track;

    library.cleanupOrphanTracks({}, { playedAt: { [track.id]: Date.now() } }, { dislikedAt: {} }, []);

    expect(library.getTrack(track.id)).not.toBeNull();
  });

  it('НЕ удаляет трек, если он в дизлайках', () => {
    const library = useLibraryStore();
    const track = makeTrack();

    library.tracks[track.id] = track;

    library.cleanupOrphanTracks({}, { playedAt: {} }, { dislikedAt: { [track.id]: Date.now() } }, []);

    expect(library.getTrack(track.id)).not.toBeNull();
  });

  it('НЕ удаляет трек, если он в очереди', () => {
    const library = useLibraryStore();
    const track = makeTrack();

    library.tracks[track.id] = track;

    library.cleanupOrphanTracks({}, { playedAt: {} }, { dislikedAt: {} }, [track]);

    expect(library.getTrack(track.id)).not.toBeNull();
  });

  it('НЕ удаляет трек, если он в folder.trackIds', () => {
    const library = useLibraryStore();
    const track = makeTrack();
    const folderId = newFolderId();

    library.tracks[track.id] = track;
    library.folders[folderId] = {
      id: folderId,
      pluginId: 'local',
      name: 'F',
      parentId: null,
      urlPath: '',
      trackIds: [track.id],
    };

    library.cleanupOrphanTracks({}, { playedAt: {} }, { dislikedAt: {} }, []);

    expect(library.getTrack(track.id)).not.toBeNull();
  });

  it('НЕ удаляет трек, у которого есть sources (даже если не в коллекциях/папках)', () => {
    const library = useLibraryStore();
    const folderId = newFolderId();
    const track = makeTrack({
      sources: [
        {
          id: 'src-1' as never,
          pluginId: 'local',
          priority: 10,
          kind: 'local',
          handle: {} as FileSystemFileHandle,
          folderId,
        },
      ],
    });

    library.tracks[track.id] = track;

    library.cleanupOrphanTracks({}, { playedAt: {} }, { dislikedAt: {} }, []);

    expect(library.getTrack(track.id)).not.toBeNull();
  });

  it('удаляет трек только с streaming-source, если он нигде не используется', () => {
    const library = useLibraryStore();
    const track = makeTrack({
      sources: [
        {
          id: 'src-1' as never,
          pluginId: 'zvuk',
          priority: 30,
          kind: 'streaming',
          url: '/api/zvuk/stream?id=123',
        },
      ],
    });

    library.tracks[track.id] = track;

    library.cleanupOrphanTracks({}, { playedAt: {} }, { dislikedAt: {} }, []);

    expect(library.getTrack(track.id)).toBeNull();
  });

  it('НЕ удаляет трек с streaming-source, если он в плейлисте', () => {
    const library = useLibraryStore();
    const track = makeTrack({
      sources: [
        {
          id: 'src-1' as never,
          pluginId: 'zvuk',
          priority: 30,
          kind: 'streaming',
          url: '/api/zvuk/stream?id=123',
        },
      ],
    });

    library.tracks[track.id] = track;

    library.cleanupOrphanTracks({ p1: { trackIds: [track.id] } }, { playedAt: {} }, { dislikedAt: {} }, []);

    expect(library.getTrack(track.id)).not.toBeNull();
  });

  it('НЕ удаляет трек с local-source, если он нигде не используется', () => {
    const library = useLibraryStore();
    const track = makeTrack({
      sources: [
        {
          id: 'src-1' as never,
          pluginId: 'local',
          priority: 10,
          kind: 'local',
          handle: {} as FileSystemFileHandle,
          folderId: 'folder-1' as never,
        },
      ],
    });

    library.tracks[track.id] = track;

    library.cleanupOrphanTracks({}, { playedAt: {} }, { dislikedAt: {} }, []);

    expect(library.getTrack(track.id)).not.toBeNull();
  });
});
