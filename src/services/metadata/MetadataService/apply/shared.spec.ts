// src/services/metadata/MetadataService/apply/shared.spec.ts

import { beforeEach, describe, expect, it } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { attachAlbum, norm, rawFromTrack, type ApplyLibrary, type ApplyWriter } from './shared';
import { useLibraryStore, createLibraryWriter } from '@/stores/library';
import { newAlbumId, newTrackId } from '@/types/ids';
import type { Track } from '@/types/track';

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

let library: ApplyLibrary;
let writer: ApplyWriter;

beforeEach(() => {
  setActivePinia(createPinia());
  library = useLibraryStore();
  writer = createLibraryWriter();
});

describe('norm', () => {
  it('сравнивает имена регистронезависимо и без обрамляющих пробелов', () => {
    expect(norm('  Rock  ')).toBe('rock');
    expect(norm('ROCK')).toBe(norm('rock'));
  });

  it('приводит отсутствие значения к пустой строке', () => {
    expect(norm(null)).toBe('');
    expect(norm(undefined)).toBe('');
  });
});

describe('rawFromTrack', () => {
  it('отдаёт существующий raw без изменений', () => {
    const track = makeTrack({ raw: { artist: 'R', title: 'T', album: 'A', coverUrl: 'https://c.jpg' } });

    expect(rawFromTrack(track, library)).toEqual({
      artist: 'R',
      title: 'T',
      album: 'A',
      coverUrl: 'https://c.jpg',
    });
  });

  it('строит снимок из текущих значений, если raw ещё нет', () => {
    const albumId = newAlbumId();
    library.albums[albumId] = { id: albumId, name: 'AlbumX', artist: 'Artist', coverUrl: null };
    const track = makeTrack({ artist: 'Artist', title: 'Title', albumId, coverUrl: 'https://t.jpg' });

    expect(rawFromTrack(track, library)).toEqual({
      artist: 'Artist',
      title: 'Title',
      album: 'AlbumX',
      coverUrl: 'https://t.jpg',
    });
  });

  it('без альбома оставляет пустое имя альбома', () => {
    const track = makeTrack({ albumId: null, coverUrl: null });

    expect(rawFromTrack(track, library)).toEqual({ artist: 'Artist', title: 'Title', album: '', coverUrl: null });
  });
});

describe('attachAlbum', () => {
  it('создаёт новый альбом и возвращает его id', () => {
    const albumId = attachAlbum(library, writer, 'New Album', 'Artist', 'https://c.jpg', null);

    expect(albumId).toBeTruthy();
    expect(library.albums[albumId!]?.name).toBe('New Album');
    expect(library.albums[albumId!]?.coverUrl).toBe('https://c.jpg');
  });

  it('при пустом имени ничего не создаёт и отдаёт fallback', () => {
    const fallback = newAlbumId();

    expect(attachAlbum(library, writer, '   ', 'Artist', 'https://c.jpg', fallback)).toBe(fallback);
    expect(Object.keys(library.albums)).toHaveLength(0);
  });

  it('дописывает обложку существующему альбому без обложки', () => {
    const albumId = newAlbumId();
    library.albums[albumId] = { id: albumId, name: 'Old', artist: 'A', coverUrl: null };

    const result = attachAlbum(library, writer, 'Old', 'A', 'https://new.jpg', null);

    expect(result).toBe(albumId);
    expect(library.albums[albumId]?.coverUrl).toBe('https://new.jpg');
  });

  it('не затирает обложку существующего альбома', () => {
    const albumId = newAlbumId();
    library.albums[albumId] = { id: albumId, name: 'Old', artist: 'A', coverUrl: 'https://existing.jpg' };

    const result = attachAlbum(library, writer, 'Old', 'A', 'https://new.jpg', null);

    expect(result).toBe(albumId);
    expect(library.albums[albumId]?.coverUrl).toBe('https://existing.jpg');
  });

  it('сопоставляет альбом по имени и артисту без учёта регистра', () => {
    const albumId = newAlbumId();
    library.albums[albumId] = { id: albumId, name: 'Random Access Memories', artist: 'Daft Punk', coverUrl: null };

    const result = attachAlbum(library, writer, 'random access memories', 'DAFT PUNK', null, null);

    expect(result).toBe(albumId);
    expect(Object.keys(library.albums)).toHaveLength(1);
  });
});
