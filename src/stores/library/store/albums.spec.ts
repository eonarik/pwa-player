// src/stores/library/store/albums.spec.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useLibraryStore, createLibraryWriter } from '../index';
import type { Album } from '@/types/album';
import { newAlbumId, newTrackId } from '@/types/ids';
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

describe('Albums CRUD через writer', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  describe('addOrUpdateAlbum', () => {
    it('создаёт новый альбом', () => {
      const library = useLibraryStore();
      const writer = createLibraryWriter();

      const album: Album = {
        id: newAlbumId(),
        name: 'New Album',
        artist: 'Test Artist',
        coverUrl: null,
      };

      writer.addOrUpdateAlbum(album);

      expect(library.getAlbum(album.id)).toEqual(album);
    });

    it('не перезаписывает обложку, если у существующего она есть', () => {
      const library = useLibraryStore();
      const writer = createLibraryWriter();
      const albumId = newAlbumId();

      writer.addOrUpdateAlbum({
        id: albumId,
        name: 'Album',
        artist: 'Artist',
        coverUrl: 'https://example.com/cover1.jpg',
      });

      writer.addOrUpdateAlbum({
        id: albumId,
        name: 'Album',
        artist: 'Artist',
        coverUrl: 'https://example.com/cover2.jpg',
      });

      expect(library.getAlbum(albumId)?.coverUrl).toBe('https://example.com/cover1.jpg');
    });

    it('обновляет обложку, если у существующего её нет', () => {
      const library = useLibraryStore();
      const writer = createLibraryWriter();
      const albumId = newAlbumId();

      writer.addOrUpdateAlbum({
        id: albumId,
        name: 'Album',
        artist: 'Artist',
        coverUrl: null,
      });

      writer.addOrUpdateAlbum({
        id: albumId,
        name: 'Album',
        artist: 'Artist',
        coverUrl: 'https://example.com/cover.jpg',
      });

      expect(library.getAlbum(albumId)?.coverUrl).toBe('https://example.com/cover.jpg');
    });
  });

  describe('removeAlbum', () => {
    it('удаляет альбом по id', () => {
      const library = useLibraryStore();
      const writer = createLibraryWriter();
      const albumId = newAlbumId();

      writer.addOrUpdateAlbum({ id: albumId, name: 'ToDelete', artist: 'X', coverUrl: null });
      expect(library.getAlbum(albumId)).not.toBeNull();

      writer.removeAlbum(albumId);
      expect(library.getAlbum(albumId)).toBeNull();
    });

    it('не падает, если альбома нет', () => {
      const writer = createLibraryWriter();
      expect(() => writer.removeAlbum(newAlbumId())).not.toThrow();
    });

    it('не трогает треки удаляемого альбома (albumId остаётся)', () => {
      // ВАЖНО: это текущее поведение. removeAlbum НЕ отвязывает треки —
      // это оставляет возможность восстановить альбом из треков.
      // (Если хотим отвязывать — это отдельная задача.)
      const library = useLibraryStore();
      const writer = createLibraryWriter();
      const albumId = newAlbumId();

      writer.addOrUpdateAlbum({ id: albumId, name: 'Album', artist: 'X', coverUrl: null });

      const track = makeTrack({ albumId });
      library.tracks[track.id] = track;

      writer.removeAlbum(albumId);

      expect(library.getAlbum(albumId)).toBeNull();
      expect(library.getTrack(track.id)?.albumId).toBe(albumId);
    });
  });
});
