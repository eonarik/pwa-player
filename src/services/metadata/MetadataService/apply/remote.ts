// src/services/metadata/MetadataService/apply/remote.ts

import { useLibraryStore, createLibraryWriter } from '@/stores/library';
import type { Track } from '@/types/track';
import type { MetadataCandidate } from '@/types/metadata';
import type { TrackId } from '@/types/ids';
import { newMetadataCandidateId } from '@/types/ids';
import type { RemoteTrackMetadata } from '../../TrackMetadataService';
import type { ApplyResult } from '../types';
import type { MetadataPersistence } from '../persistence';
import { attachAlbum, norm, notifyTrackUpdated, rawFromTrack } from './shared';

/**
 * Применение результата автопоиска (RemoteTrackMetadata).
 *
 * Два исхода: уверенное совпадение (confident) — патчим трек; неуверенное —
 * кладём кандидата в список на подтверждение пользователем.
 */
export function createRemoteApply(persistence: MetadataPersistence) {
  function applyRemote(trackId: TrackId, incoming: RemoteTrackMetadata, force = false): ApplyResult {
    const library = useLibraryStore();
    const track = library.getTrack(trackId);
    if (!track) return { status: 'skipped', reason: 'not-found' };

    // Теги из файла — не трогаем без явного force.
    if (track.hasId3Tags && !force) {
      return { status: 'skipped', reason: 'protected' };
    }

    persistence.saveToCache(track, incoming);

    const isArtistStrict = norm(track.artist) === norm(incoming.artist);
    const isTitleStrict = norm(track.title) === norm(incoming.title);
    const isStrictMatch = isArtistStrict && isTitleStrict;

    if (incoming.confident) {
      applyPatch(track, incoming, isStrictMatch, force, isArtistStrict);
      notifyTrackUpdated(trackId);
      return { status: 'applied' };
    }

    const candidate: MetadataCandidate = {
      id: newMetadataCandidateId(),
      artist: incoming.artist,
      title: incoming.title,
      album: incoming.album,
      coverUrl: incoming.coverUrl,
      similarity: incoming.similarity,
      provider: incoming.source,
    };

    const alreadyHas = track.metadataCandidates.some(
      (c) => norm(c.artist) === norm(candidate.artist) && norm(c.title) === norm(candidate.title),
    );

    if (!alreadyHas) {
      createLibraryWriter().updateTrackMetadataCandidates(trackId, [...track.metadataCandidates, candidate]);
    }

    return { status: 'candidates' };
  }

  /**
   * Патч трека из автопоиска.
   *
   * `allowMetadataOverwrite` — title совпадает строго; `isArtistStrict` —
   * артист совпадает строго. Ручные правки (hasMetadataEdits) перетираются
   * только force.
   */
  function applyPatch(
    track: Track,
    incoming: RemoteTrackMetadata,
    allowMetadataOverwrite: boolean,
    force = false,
    isArtistStrict = false,
  ): void {
    const library = useLibraryStore();
    const writer = createLibraryWriter();

    const nextAlbumId = attachAlbum(
      library,
      writer,
      incoming.album || track.raw?.album || '',
      incoming.artist || track.artist,
      incoming.coverUrl,
      track.albumId,
    );

    const canOverwriteArtist = (isArtistStrict || force) && (!track.hasMetadataEdits || force);
    const canOverwriteTitle = (allowMetadataOverwrite || isArtistStrict || force) && (!track.hasMetadataEdits || force);

    const nextArtist = canOverwriteArtist ? incoming.artist || track.artist : track.artist;
    const nextTitle = canOverwriteTitle ? incoming.title || track.title : track.title;

    writer.updateTrackMetadata(track.id, {
      artist: nextArtist,
      title: nextTitle,
      albumId: nextAlbumId,
      // Обложка альбома живёт на альбоме; на треке — только если альбома нет.
      coverUrl: nextAlbumId ? null : incoming.coverUrl,
      hasMetadataEdits: canOverwriteArtist || canOverwriteTitle || track.hasMetadataEdits,
      metaSource: 'auto',
      raw: rawFromTrack(track, library),
    });

    persistence.saveCacheForTrack(track);
  }

  return { applyRemote, applyPatch };
}

export type RemoteApply = ReturnType<typeof createRemoteApply>;
