// src/services/metadata/MetadataService.applyRemote.spec.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { metadataService } from './MetadataService';
import { useLibraryStore, createLibraryWriter } from '@/stores/library';
import { newTrackId, newAlbumId } from '@/types/ids';
import type { Track } from '@/types/track';

function makeTrack(overrides: Partial<Track> = {}): Track {
  return {
    id: newTrackId(),
    pluginId: 'local',
    artist: 'Би-2',
    title: 'Компромисс',
    albumId: null,
    coverUrl: null,
    sources: [],
    metadataCandidates: [],
    raw: null,
    hasId3Tags: false, // Важно: разрешаем автопоиск
    ...overrides,
  };
}

describe('MetadataService.applyRemote (обновление обложек)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('создаёт новый альбом с обложкой, если у трека не было альбома', () => {
    const library = useLibraryStore();
    const track = makeTrack({ albumId: null });
    library.tracks[track.id] = track;

    // Применяем метаданные
    const result = metadataService.applyRemote(track.id, {
      artist: 'Би-2',
      title: 'Компромисс',
      album: 'Свиридов',
      coverUrl: 'https://zvuk.com/new-cover.jpg',
      source: 'zvuk',
      similarity: 1,
      confident: true,
    });

    expect(result.status).toBe('applied');

    const updatedTrack = library.getTrack(track.id);
    expect(updatedTrack?.albumId).not.toBeNull();

    const album = library.getAlbum(updatedTrack!.albumId!);
    expect(album?.name).toBe('Свиридов');
    expect(album?.coverUrl).toBe('https://zvuk.com/new-cover.jpg');
  });

  it('ОБНОВЛЯЕТ обложку существующего альбома, если там было пусто', () => {
    const library = useLibraryStore();
    const writer = createLibraryWriter();

    // Ситуация: в библиотеке уже есть альбом "Свиридов" БЕЗ обложки (например, создан при импорте)
    const existingAlbumId = newAlbumId();
    writer.addOrUpdateAlbum({
      id: existingAlbumId,
      name: 'Свиридов',
      artist: 'Би-2',
      coverUrl: null,
    });

    // Трек уже привязан к этому пустому альбому
    const track = makeTrack({ albumId: existingAlbumId });
    library.tracks[track.id] = track;

    // Применяем метаданные из Звука
    const result = metadataService.applyRemote(track.id, {
      artist: 'Би-2',
      title: 'Компромисс',
      album: 'Свиридов',
      coverUrl: 'https://zvuk.com/new-cover.jpg',
      source: 'zvuk',
      similarity: 1,
      confident: true,
    });

    expect(result.status).toBe('applied');

    // ГЛАВНАЯ ПРОВЕРКА: обложка в существующем альбоме должна обновиться
    const album = library.getAlbum(existingAlbumId);
    expect(album?.coverUrl).toBe('https://zvuk.com/new-cover.jpg');
  });

  it('НЕ перезаписывает обложку существующего альбома, если там уже есть картинка', () => {
    const library = useLibraryStore();
    const writer = createLibraryWriter();

    const existingAlbumId = newAlbumId();
    writer.addOrUpdateAlbum({
      id: existingAlbumId,
      name: 'Свиридов',
      artist: 'Би-2',
      coverUrl: 'https://user-uploaded-cover.jpg', // Пользовательская обложка
    });

    const track = makeTrack({ albumId: existingAlbumId });
    library.tracks[track.id] = track;

    metadataService.applyRemote(track.id, {
      artist: 'Би-2',
      title: 'Компромисс',
      album: 'Свиридов',
      coverUrl: 'https://zvuk.com/new-cover.jpg',
      source: 'zvuk',
      similarity: 1,
      confident: true,
    });

    // Обложка не должна перезаписаться
    const album = library.getAlbum(existingAlbumId);
    expect(album?.coverUrl).toBe('https://user-uploaded-cover.jpg');
  });
});
