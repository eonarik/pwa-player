// src/services/metadata/MetadataService/apply/shared.ts

import { useLibraryStore, createLibraryWriter } from '@/stores/library';
import { resolveAlbumByName } from '@/services/library/EntityGraph';
import { eventBus } from '@/services/events/bus';
import type { AlbumId, TrackId } from '@/types/ids';
import type { Track } from '@/types/track';
import type { RawMetadata } from '@/types/metadata';

/** Стор библиотеки в том виде, в каком он нужен apply-операциям. */
export type ApplyLibrary = ReturnType<typeof useLibraryStore>;

/** Writer библиотеки: единственный способ изменить треки/альбомы. */
export type ApplyWriter = ReturnType<typeof createLibraryWriter>;

/** Нормализация имени для сравнения: регистронезависимо, без обрамляющих пробелов. */
export const norm = (value: string | null | undefined): string => (value ?? '').trim().toLowerCase();

/**
 * Уведомляет, что метаданные трека изменились.
 *
 * Через шину событий, а не прямым вызовом: сервис метаданных не должен
 * знать о сторе плеера (иначе граф импортов замыкается в цикл).
 * Подписка — в `stores/player`.
 */
export function notifyTrackUpdated(trackId: TrackId): void {
  eventBus.emit('track:metadata-updated', trackId);
}

/**
 * Резолвит альбом по имени/артисту и сохраняет результат (новый альбом или
 * дописанная обложка существующего).
 *
 * @param fallbackAlbumId — что вернуть, если имя альбома пустое: обычно
 *   `track.albumId` (сохраняем привязку) либо `null` (ручной режим).
 */
export function attachAlbum(
  library: ApplyLibrary,
  writer: ApplyWriter,
  name: string,
  artist: string,
  coverUrl: string | null,
  fallbackAlbumId: AlbumId | null,
): AlbumId | null {
  const albumRes = resolveAlbumByName(name, artist, coverUrl, Object.values(library.albums));

  if (albumRes?.album) {
    writer.addOrUpdateAlbum(albumRes.album);
    return albumRes.album.id;
  }

  return fallbackAlbumId;
}

/**
 * Снимок первичных метаданных. Если `raw` ещё нет — считаем первичными текущие
 * значения трека (именно их вернёт сброс метаданных).
 */
export function rawFromTrack(track: Track, library: ApplyLibrary): RawMetadata {
  return (
    track.raw ?? {
      artist: track.artist,
      title: track.title,
      album: track.albumId ? (library.getAlbum(track.albumId)?.name ?? '') : '',
      coverUrl: track.coverUrl,
    }
  );
}
