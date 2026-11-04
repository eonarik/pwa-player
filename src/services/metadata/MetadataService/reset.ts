// src/services/metadata/MetadataService/reset.ts

import { useLibraryStore, createLibraryWriter } from '@/stores/library';
import { usePlayerStore } from '@/stores/player';
import { metadataPersistenceService } from '@/services/persistence/MetadataPersistenceService';
import { resolveAlbumByName } from '@/services/library/EntityGraph';
import { resetProcessedTrack } from '../AutoFetchRegistry';
import type { TrackId } from '@/types/ids';
import type { MetadataPersistence } from './persistence';

export function createMetadataReset(persistence: MetadataPersistence) {
  function syncPlayerQueue(trackId: TrackId): void {
    usePlayerStore().updateTrackInQueue(trackId);
  }

  async function reset(trackId: TrackId): Promise<void> {
    const library = useLibraryStore();
    const track = library.getTrack(trackId);
    if (!track) return;

    const writer = createLibraryWriter();

    if (!track.raw) {
      // Если raw нет (старый трек), сбрасываем флаги, чтобы автопоиск сработал заново
      console.warn(`[reset] track "${trackId}" has no raw metadata, forcing reset flags`);
      writer.updateTrackMetadata(trackId, {
        albumId: null,
        coverUrl: null,
        metadataCandidates: [],
        hasMetadataEdits: false,
        metaSource: 'filename',
      });
      await metadataPersistenceService.resetForTracks([trackId]);
      resetProcessedTrack(trackId);
      return;
    }
    const rawArtist = track.raw.artist;
    const rawTitle = track.raw.title;
    const rawAlbum = track.raw.album;
    const rawCover = track.raw.coverUrl;

    let nextAlbumId = null;
    let nextCover = rawCover;

    if (rawAlbum && rawAlbum.trim()) {
      const albumRes = resolveAlbumByName(rawAlbum, rawArtist, rawCover, Object.values(library.albums));
      if (albumRes?.album) {
        writer.addOrUpdateAlbum(albumRes.album);
        nextAlbumId = albumRes.album.id;
        nextCover = null;
      }
    }

    writer.updateTrackMetadata(trackId, {
      artist: rawArtist,
      title: rawTitle,
      albumId: nextAlbumId,
      coverUrl: nextCover,
      metadataCandidates: [],
      hasMetadataEdits: false,
      metaSource: 'filename',
    });

    await metadataPersistenceService.resetForTracks([trackId]);
    await metadataPersistenceService.flush();

    persistence.saveCacheForTrack(track);
    syncPlayerQueue(trackId);

    resetProcessedTrack(trackId);
  }

  async function resetMany(trackIds: TrackId[]): Promise<void> {
    for (const id of trackIds) {
      await reset(id);
    }
  }

  return {
    reset,
    resetMany,
  };
}

export type MetadataReset = ReturnType<typeof createMetadataReset>;
