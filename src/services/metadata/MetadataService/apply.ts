// src/services/metadata/MetadataService/apply.ts

import { useLibraryStore, createLibraryWriter } from '@/stores/library';
import { usePlayerStore } from '@/stores/player';
import { loadPlugin } from '@/plugins/registry';
import { resolveAlbumByName } from '@/services/library/EntityGraph';
import type { Track } from '@/types/track';
import type { MetadataCandidate } from '@/types/metadata';
import type { TrackId } from '@/types/ids';
import { newMetadataCandidateId } from '@/types/ids';
import type { RemoteTrackMetadata } from '../TrackMetadataService';
import type { ApplyResult, ManualPatch } from './types';
import type { MetadataPersistence } from './persistence';

export function createMetadataApply(persistence: MetadataPersistence) {
  function applyRemote(trackId: TrackId, incoming: RemoteTrackMetadata): ApplyResult {
    const library = useLibraryStore();
    const track = library.getTrack(trackId);
    if (!track) return { status: 'skipped', reason: 'not-found' };

    if (track.hasId3Tags) {
      return { status: 'skipped', reason: 'protected' };
    }

    persistence.saveToCache(track, incoming);

    const isArtistStrict = (track.artist || '').trim().toLowerCase() === (incoming.artist || '').trim().toLowerCase();
    const isTitleStrict = (track.title || '').trim().toLowerCase() === (incoming.title || '').trim().toLowerCase();
    const isStrictMatch = isArtistStrict && isTitleStrict;

    if (incoming.confident) {
      applyPatch(track, incoming, isStrictMatch);
      syncPlayerQueue(trackId);
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

    const writer = createLibraryWriter();
    const alreadyHas = track.metadataCandidates.some(
      (c) =>
        c.artist.trim().toLowerCase() === candidate.artist.trim().toLowerCase() &&
        c.title.trim().toLowerCase() === candidate.title.trim().toLowerCase(),
    );

    if (!alreadyHas) {
      writer.updateTrackMetadataCandidates(trackId, [...track.metadataCandidates, candidate]);
    }

    return { status: 'candidates' };
  }

  function applyPatch(track: Track, incoming: RemoteTrackMetadata, allowMetadataOverwrite: boolean): void {
    const library = useLibraryStore();
    const writer = createLibraryWriter();

    const albumRes = resolveAlbumByName(
      incoming.album || track.raw?.album || '',
      incoming.artist || track.artist,
      incoming.coverUrl,
      Object.values(library.albums),
    );

    const nextAlbumId = albumRes?.album.id ?? track.albumId;

    if (albumRes?.album) {
      writer.addOrUpdateAlbum(albumRes.album);
    }

    const nextArtist = allowMetadataOverwrite ? incoming.artist || track.artist : track.artist;
    const nextTitle = incoming.title || track.title;

    writer.updateTrackMetadata(track.id, {
      artist: nextArtist,
      title: nextTitle,
      albumId: nextAlbumId,
      coverUrl: nextAlbumId ? null : incoming.coverUrl,
      hasMetadataEdits: true,
      metaSource: 'auto',
    });

    persistence.saveCacheForTrack(track);
  }

  function applyFromFile(trackId: TrackId, parsed: import('../types').TrackMetadata): void {
    const library = useLibraryStore();
    const track = library.getTrack(trackId);
    if (!track) return;

    const writer = createLibraryWriter();

    const currentAlbumName = track.albumId ? (library.getAlbum(track.albumId)?.name ?? '') : '';
    const rawAlbumName = track.raw?.album ?? '';

    const isManual =
      track.artist.trim().toLowerCase() !== (track.raw?.artist ?? '').trim().toLowerCase() ||
      track.title.trim().toLowerCase() !== (track.raw?.title ?? '').trim().toLowerCase() ||
      currentAlbumName.trim().toLowerCase() !== rawAlbumName.trim().toLowerCase();

    const nextArtist = isManual ? track.artist : parsed.artist || track.artist;
    const nextTitle = isManual ? track.title : parsed.title || track.title;
    const nextAlbum = isManual ? (track.raw?.album ?? '') : parsed.album || track.raw?.album || '';

    const albumRes = resolveAlbumByName(
      nextAlbum,
      nextArtist,
      parsed.coverUrl ?? track.raw?.coverUrl ?? null,
      Object.values(library.albums),
    );

    const nextAlbumId = albumRes?.album.id ?? track.albumId;

    if (albumRes?.album) {
      writer.addOrUpdateAlbum(albumRes.album);
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
      coverUrl: nextAlbumId ? null : (parsed.coverUrl ?? track.coverUrl),
      hasId3Tags: parsed.hasId3Tags || track.hasId3Tags,
      duration: parsed.duration ?? track.duration,
      codec: parsed.codec ?? track.codec,
      raw: nextRaw,
      hasMetadataEdits: true,
      metaSource: 'file',
    });

    persistence.saveCacheForTrack(track);
    syncPlayerQueue(trackId);
  }

  function updateManual(trackId: TrackId, patch: ManualPatch): void {
    const library = useLibraryStore();
    const track = library.getTrack(trackId);
    if (!track) return;

    const writer = createLibraryWriter();

    const albumRes = resolveAlbumByName(
      patch.album,
      patch.artist,
      patch.coverUrl ?? null,
      Object.values(library.albums),
    );

    const nextAlbumId = albumRes?.album.id ?? null;

    if (albumRes?.album) {
      writer.addOrUpdateAlbum(albumRes.album);
    }

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
    });

    persistence.setManualInMemory(trackId, patch, nextCoverUrl);

    persistence.scheduleFlush();
    persistence.saveCacheForTrack(track);
    syncPlayerQueue(trackId);
  }

  async function applyCandidate(trackId: TrackId, candidate: MetadataCandidate): Promise<void> {
    updateManual(trackId, {
      artist: candidate.artist,
      title: candidate.title,
      album: candidate.album,
      coverUrl: candidate.coverUrl ?? undefined,
    });

    if (candidate.extMetadata) {
      await invokeApplyCandidate(candidate.provider, trackId, candidate.extMetadata);
    }
  }

  async function invokeApplyCandidate(
    provider: string,
    trackId: TrackId,
    extMetadata: Record<string, unknown>,
  ): Promise<void> {
    try {
      const plugin = await loadPlugin(provider);
      if (!plugin.applyCandidate) return;
      await plugin.applyCandidate(trackId, extMetadata);
    } catch (err) {
      console.warn(`[metadata] applyCandidate failed for provider "${provider}"`, err);
    }
  }

  function syncPlayerQueue(trackId: TrackId): void {
    const player = usePlayerStore();
    player.updateTrackInQueue(trackId);
  }

  return {
    applyRemote,
    applyPatch,
    applyFromFile,
    updateManual,
    applyCandidate,
    invokeApplyCandidate,
  };
}

export type MetadataApply = ReturnType<typeof createMetadataApply>;
