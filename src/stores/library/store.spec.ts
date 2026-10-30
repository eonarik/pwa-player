// src/stores/library/store.spec.ts

 
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useLibraryStore } from './store';
import type { Track } from '@/types/track';
import { newTrackId, newTrackSourceId, newAlbumId, newFolderId } from '@/types/ids';

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

describe('useLibraryStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('tracksByAlbumId группирует треки по albumId', () => {
    const library = useLibraryStore();
    const albumId = newAlbumId();

    const t1 = makeTrack({ albumId });
    const t2 = makeTrack({ albumId });
    const t3 = makeTrack({ albumId: null });

    library.tracks[t1.id] = t1;
    library.tracks[t2.id] = t2;
    library.tracks[t3.id] = t3;

    expect(library.tracksByAlbumId[albumId]).toHaveLength(2);
    expect(library.tracksByAlbumId[albumId]).toContain(t1.id);
    expect(library.tracksByAlbumId[albumId]).toContain(t2.id);
  });

  it('tracksByFolderId группирует треки по folderId из sources', () => {
    const library = useLibraryStore();
    const folderId = newFolderId();

    const t1 = makeTrack({
      sources: [
        {
          id: newTrackSourceId(),
          pluginId: 'local',
          priority: 10,
          kind: 'local',
          handle: {} as any,
          folderId,
        },
      ],
    });
    const t2 = makeTrack({
      sources: [
        {
          id: newTrackSourceId(),
          pluginId: 'local',
          priority: 10,
          kind: 'streaming',
          url: 'http://...',
        },
      ],
    });

    library.tracks[t1.id] = t1;
    library.tracks[t2.id] = t2;

    expect(library.tracksByFolderId[folderId]).toHaveLength(1);
    expect(library.tracksByFolderId[folderId]?.[0]).toBe(t1.id);
  });
});
