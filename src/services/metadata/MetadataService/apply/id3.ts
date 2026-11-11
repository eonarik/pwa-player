// src/services/metadata/MetadataService/apply/id3.ts

import { useLibraryStore, createLibraryWriter } from '@/stores/library';
import type { TrackId } from '@/types/ids';
import type { TrackMetadata } from '../../types';
import type { MetadataPersistence } from '../persistence';
import { attachAlbum, norm, notifyTrackUpdated } from './shared';

/**
 * Применение метаданных, прочитанных из самого файла (ID3), и первичного
 * снимка `raw`.
 */
export function createId3Apply(persistence: MetadataPersistence) {
  /**
   * @param trackId — id трека
   * @param parsed — метаданные из ID3 (без обложки)
   * @param coverBlob — Blob обложки из ID3 (или null)
   */
  function applyFromFile(trackId: TrackId, parsed: TrackMetadata, coverBlob: Blob | null = null): void {
    const library = useLibraryStore();
    const track = library.getTrack(trackId);
    if (!track) return;

    const writer = createLibraryWriter();

    // Ручная правка уже сделана, если текущие значения не совпадают с raw:
    // тогда файл не перетираем, а оставляем то, что ввёл пользователь.
    const currentAlbumName = track.albumId ? (library.getAlbum(track.albumId)?.name ?? '') : '';
    const isManual =
      norm(track.artist) !== norm(track.raw?.artist) ||
      norm(track.title) !== norm(track.raw?.title) ||
      norm(currentAlbumName) !== norm(track.raw?.album);

    const nextArtist = isManual ? track.artist : parsed.artist || track.artist;
    const nextTitle = isManual ? track.title : parsed.title || track.title;
    const nextAlbum = isManual ? (track.raw?.album ?? '') : parsed.album || track.raw?.album || '';

    const nextAlbumId = attachAlbum(library, writer, nextAlbum, nextArtist, parsed.coverUrl ?? null, track.albumId);

    // Blob из ID3 — только в Album.coverBlob (если есть альбом).
    // «Кто первый» — не перезаписываем существующий.
    if (coverBlob && nextAlbumId) {
      const album = library.getAlbum(nextAlbumId);
      if (album && !album.coverBlob) {
        writer.addOrUpdateAlbum({ ...album, coverBlob });
      }
    }

    const nextRaw = track.raw ?? {
      artist: parsed.artist,
      title: parsed.title,
      album: parsed.album,
      coverUrl: parsed.coverUrl ?? null,
    };

    writer.updateTrackMetadata(trackId, {
      artist: nextArtist,
      title: nextTitle,
      albumId: nextAlbumId,
      coverUrl: nextAlbumId ? null : (parsed.coverUrl ?? track.coverUrl ?? null),
      hasId3Tags: parsed.hasId3Tags || track.hasId3Tags,
      duration: parsed.duration ?? track.duration,
      codec: parsed.codec ?? track.codec,
      raw: nextRaw,
      hasMetadataEdits: isManual,
      metaSource: parsed.hasId3Tags ? 'file' : 'filename',
    });

    persistence.saveCacheForTrack(track);
    notifyTrackUpdated(trackId);
  }

  return { applyFromFile };
}

export type Id3Apply = ReturnType<typeof createId3Apply>;
