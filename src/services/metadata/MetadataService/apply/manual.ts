// src/services/metadata/MetadataService/apply/manual.ts

import { useLibraryStore, createLibraryWriter } from '@/stores/library';
import type { TrackId } from '@/types/ids';
import type { ManualPatch } from '../types';
import type { MetadataPersistence } from '../persistence';
import { attachAlbum, notifyTrackUpdated, rawFromTrack } from './shared';

/**
 * Ручное редактирование метаданных пользователем (модалка трека, выбор
 * кандидата). Ручные значения — приоритет над всеми автоисточниками.
 */
export function createManualApply(persistence: MetadataPersistence) {
  function updateManual(trackId: TrackId, patch: ManualPatch): void {
    const library = useLibraryStore();
    const track = library.getTrack(trackId);
    if (!track) return;

    const writer = createLibraryWriter();

    const nextAlbumId = attachAlbum(library, writer, patch.album, patch.artist, patch.coverUrl ?? null, null);

    // Обложка альбома живёт на альбоме. Локальный blob-URL превращаем в
    // обложку альбома, иначе — берём обложку альбома (или null для трека).
    let nextCoverUrl = patch.coverUrl ?? null;

    if (nextAlbumId && nextCoverUrl && nextCoverUrl.startsWith('blob:')) {
      const album = library.getAlbum(nextAlbumId);
      if (album) {
        writer.addOrUpdateAlbum({ ...album, coverUrl: nextCoverUrl });
      }
      nextCoverUrl = null;
    } else if (nextAlbumId) {
      const album = library.getAlbum(nextAlbumId);
      nextCoverUrl = album?.coverUrl ?? null;
    }

    writer.updateTrackMetadata(trackId, {
      artist: patch.artist,
      title: patch.title,
      albumId: nextAlbumId,
      coverUrl: nextAlbumId ? null : nextCoverUrl,
      metadataCandidates: [],
      hasMetadataEdits: true,
      metaSource: 'manual',
      raw: rawFromTrack(track, library),
    });

    persistence.setManualInMemory(trackId, patch, nextCoverUrl);

    persistence.scheduleFlush();
    persistence.saveCacheForTrack(track);
    notifyTrackUpdated(trackId);
  }

  return { updateManual };
}

export type ManualApply = ReturnType<typeof createManualApply>;
