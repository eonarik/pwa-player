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
import type { TrackMetadata } from '../types';
import type { ApplyResult, ManualPatch } from './types';
import type { MetadataPersistence } from './persistence';
import { useDislikesStore } from '@/stores/dislikes';
import { useHistoryStore } from '@/stores/history';
import { usePlaylistsStore } from '@/stores/playlists';
import { isSameSource } from '@/services/library/TrackMerger';

export function createMetadataApply(persistence: MetadataPersistence) {
  function applyRemote(trackId: TrackId, incoming: RemoteTrackMetadata, force = false): ApplyResult {
    const library = useLibraryStore();
    const track = library.getTrack(trackId);
    if (!track) return { status: 'skipped', reason: 'not-found' };

    if (track.hasId3Tags && !force) {
      return { status: 'skipped', reason: 'protected' };
    }

    persistence.saveToCache(track, incoming);

    const isArtistStrict = (track.artist || '').trim().toLowerCase() === (incoming.artist || '').trim().toLowerCase();
    const isTitleStrict = (track.title || '').trim().toLowerCase() === (incoming.title || '').trim().toLowerCase();
    const isStrictMatch = isArtistStrict && isTitleStrict;

    if (incoming.confident) {
      applyPatch(track, incoming, isStrictMatch, force, isArtistStrict);
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

  function applyPatch(
    track: Track,
    incoming: RemoteTrackMetadata,
    allowMetadataOverwrite: boolean,
    force = false,
    isArtistStrict = false,
  ): void {
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

    const canOverwriteArtist = (isArtistStrict || force) && (!track.hasMetadataEdits || force);
    const canOverwriteTitle = (allowMetadataOverwrite || isArtistStrict || force) && (!track.hasMetadataEdits || force);

    const nextArtist = canOverwriteArtist ? incoming.artist || track.artist : track.artist;
    const nextTitle = canOverwriteTitle ? incoming.title || track.title : track.title;

    const nextRaw = track.raw ?? {
      artist: track.artist,
      title: track.title,
      album: track.albumId ? (library.getAlbum(track.albumId)?.name ?? '') : '',
      coverUrl: track.coverUrl,
    };

    writer.updateTrackMetadata(track.id, {
      artist: nextArtist,
      title: nextTitle,
      albumId: nextAlbumId,
      coverUrl: nextAlbumId ? null : incoming.coverUrl,
      hasMetadataEdits: canOverwriteArtist || canOverwriteTitle || track.hasMetadataEdits,
      metaSource: 'auto',
      raw: nextRaw,
    });

    persistence.saveCacheForTrack(track);
  }

  /**
   * Применяет метаданные из ID3 (парсинг файла).
   *
   * @param trackId — id трека
   * @param parsed — метаданные из ID3 (без обложки)
   * @param coverBlob — Blob обложки из ID3 (или null)
   */
  function applyFromFile(trackId: TrackId, parsed: TrackMetadata, coverBlob: Blob | null = null): void {
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

    const albumRes = resolveAlbumByName(nextAlbum, nextArtist, parsed.coverUrl ?? null, Object.values(library.albums));

    const nextAlbumId = albumRes?.album.id ?? track.albumId;

    if (albumRes?.album) {
      writer.addOrUpdateAlbum(albumRes.album);
    }

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

    const nextRaw = track.raw ?? {
      artist: track.artist,
      title: track.title,
      album: track.albumId ? (library.getAlbum(track.albumId)?.name ?? '') : '',
      coverUrl: track.coverUrl,
    };

    writer.updateTrackMetadata(trackId, {
      artist: patch.artist,
      title: patch.title,
      albumId: nextAlbumId,
      coverUrl: nextAlbumId ? null : nextCoverUrl,
      metadataCandidates: [],
      hasMetadataEdits: true,
      metaSource: 'manual',
      raw: nextRaw,
    });

    persistence.setManualInMemory(trackId, patch, nextCoverUrl);

    persistence.scheduleFlush();
    persistence.saveCacheForTrack(track);
    syncPlayerQueue(trackId);
  }

  async function applyCandidate(trackId: TrackId, candidate: MetadataCandidate): Promise<void> {
    const library = useLibraryStore();
    const writer = createLibraryWriter();

    const mergeTarget = candidate.extMetadata?.mergeWithTrackId;
    const candidateTrack = library.getTrack(trackId);

    // Резолв кандидата: если у candidate есть ссылка на existing — мержим.
    if (typeof mergeTarget === 'string' && mergeTarget !== trackId && candidateTrack) {
      const target = library.getTrack(mergeTarget as TrackId);
      if (target) {
        // 1. Объединяем sources (target + candidate).
        const combined = [...target.sources, ...candidateTrack.sources];
        const unique: typeof combined = [];
        for (const s of combined) {
          if (!unique.some((u) => isSameSource(u, s))) {
            unique.push(s);
          }
        }
        unique.sort((a, b) => a.priority - b.priority);

        // 2. Обновляем sources у target (trackId — удалим).
        writer.updateTrackSources(target.id, unique);

        // 3. Заменяем trackId в плейлистах/истории/дизлайках.
        //    (reconcile замену не делает для произвольных треков — вызываем вручную.)
        // Используем playlists/history/dislikes stores.
        const playlists = usePlaylistsStore();
        for (const playlist of Object.values(playlists.playlists)) {
          const idx = playlist.trackIds.indexOf(trackId);
          if (idx !== -1) {
            playlist.trackIds[idx] = target.id;
            playlist.trackIds = Array.from(new Set(playlist.trackIds));
            playlist.updatedAt = Date.now();
          }
        }
        playlists.save();

        const history = useHistoryStore();
        const historyTs = history.history.playedAt[trackId];
        if (historyTs !== undefined) {
          if (history.history.playedAt[target.id] === undefined) {
            history.history.playedAt[target.id] = historyTs;
          }
          delete history.history.playedAt[trackId];
        }

        const dislikes = useDislikesStore();
        const dislikeTs = dislikes.dislikes.dislikedAt[trackId];
        if (dislikeTs !== undefined) {
          if (dislikes.dislikes.dislikedAt[target.id] === undefined) {
            dislikes.dislikes.dislikedAt[target.id] = dislikeTs;
          }
          delete dislikes.dislikes.dislikedAt[trackId];
        }

        // 4. Удаляем трек-кандидат.
        writer.removeTrack(trackId);

        // 5. Применяем метаданные кандидата к target (artist/title/album).
        updateManual(target.id, {
          artist: candidate.artist,
          title: candidate.title,
          album: candidate.album,
          coverUrl: candidate.coverUrl ?? undefined,
        });

        return;
      }
    }

    // Стандартный резолв (нет mergeWithTrackId) — просто обновляем метаданные.
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

      if (plugin.isDisconnected?.()) {
        return;
      }

      if (!plugin.applyCandidate) {
        return;
      }

      await plugin.applyCandidate(trackId, extMetadata);
    } catch (err) {
      console.error(`[metadata] applyCandidate failed for provider "${provider}"`, err);
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
