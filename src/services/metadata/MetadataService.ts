// src/services/metadata/MetadataService.ts

import { metadataPersistenceService } from '@/services/persistence/MetadataPersistenceService';
import { useLibraryStore, createLibraryWriter } from '@/stores/library';
import { usePlayerStore } from '@/stores/player';
import { useUiSettingsStore } from '@/stores/uiSettings';
import { loadPlugin } from '@/plugins/registry';
import { createPluginContext } from '@/plugins/context';
import { resolveAlbumByName } from '@/services/library/EntityGraph';
import { trackMetadataService } from './TrackMetadataService';
import type { Track } from '@/types/track';
import type { MetadataCandidate } from '@/types/metadata';
import type { TrackMetadata } from './types';
import type { RemoteTrackMetadata } from './TrackMetadataService';
import type { TrackId } from '@/types/ids';
import { newMetadataCandidateId } from '@/types/ids';
import { resetProcessedTrack } from './AutoFetchRegistry';

export type ApplyResult =
  { status: 'applied' } | { status: 'candidates' } | { status: 'skipped'; reason: 'not-found' | 'protected' };

export interface ManualPatch {
  artist: string;
  title: string;
  album: string;
  coverUrl: string | undefined;
}

export type FetchResult =
  | { status: 'applied' }
  | { status: 'candidates' }
  | { status: 'not-found' }
  | { status: 'error'; message: string }
  | { status: 'aborted' }
  | { status: 'skipped'; reason: 'protected' | 'not-found' };

const FLUSH_DEBOUNCE_MS = 500;

class MetadataService {
  private static instance: MetadataService | null = null;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  static getInstance(): MetadataService {
    if (!MetadataService.instance) {
      MetadataService.instance = new MetadataService();
    }
    return MetadataService.instance;
  }

  async fetchAndApply(trackId: TrackId, signal?: AbortSignal): Promise<FetchResult> {
    const library = useLibraryStore();
    const uiSettings = useUiSettingsStore();
    const track = library.getTrack(trackId);

    if (!track) return { status: 'skipped', reason: 'not-found' };
    if (track.hasId3Tags) return { status: 'skipped', reason: 'protected' };

    if (signal?.aborted) return { status: 'aborted' };

    const threshold = uiSettings.metadataThreshold;

    // 1. Пробуем СберЗвук
    const zvukEnabled = localStorage.getItem('zvuk:fetchMetadata') !== 'false';
    if (zvukEnabled) {
      try {
        const zvukPlugin = await loadPlugin('zvuk');
        if (zvukPlugin.fetchMetadata) {
          const zvukData = await zvukPlugin.fetchMetadata(track.artist, track.title);

          if (signal?.aborted) return { status: 'aborted' };

          if (zvukData && zvukData.similarity >= threshold) {
            const applyResult = this.applyRemote(trackId, {
              artist: zvukData.artist,
              title: zvukData.title,
              album: zvukData.album,
              coverUrl: zvukData.coverUrl,
              source: 'zvuk',
              similarity: zvukData.similarity,
              confident: zvukData.confident,
            });
            return applyResult.status === 'applied' ? { status: 'applied' } : { status: 'candidates' };
          }
        }
      } catch (err) {
        console.warn('[metadata] zvuk failed', err);
      }
    }

    // 2. iTunes / Deezer
    try {
      const result = await trackMetadataService.fetch(track.artist ?? '', track.title, threshold, signal);

      if (signal?.aborted || result.status === 'aborted') {
        return { status: 'aborted' };
      }

      if (result.status === 'not-found') {
        this.markNotFound(trackId);
        return { status: 'not-found' };
      }

      if (result.status === 'error') {
        return { status: 'error', message: result.message };
      }

      const applyResult = this.applyRemote(trackId, result.data);
      return applyResult.status === 'applied' ? { status: 'applied' } : { status: 'candidates' };
    } catch (err) {
      return { status: 'error', message: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  applyRemote(trackId: TrackId, incoming: RemoteTrackMetadata): ApplyResult {
    const library = useLibraryStore();
    const track = library.getTrack(trackId);
    if (!track) return { status: 'skipped', reason: 'not-found' };

    if (track.hasId3Tags) {
      return { status: 'skipped', reason: 'protected' };
    }

    this.saveToCache(track, incoming);

    const isArtistStrict = (track.artist || '').trim().toLowerCase() === (incoming.artist || '').trim().toLowerCase();
    const isTitleStrict = (track.title || '').trim().toLowerCase() === (incoming.title || '').trim().toLowerCase();
    const isStrictMatch = isArtistStrict && isTitleStrict;

    if (incoming.confident) {
      this.applyPatch(track, incoming, isStrictMatch);
      this.syncPlayerQueue(trackId);
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

  updateManual(trackId: TrackId, patch: ManualPatch): void {
    const library = useLibraryStore();
    const track = library.getTrack(trackId);
    if (!track) return;

    const writer = createLibraryWriter();

    // 1. Обрабатываем альбом
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

    // 2. Логика обложки:
    // - Если загружена новая обложка (blob), сохраняем ее в трек (если нет альбома) или в альбом
    // - Если нет, оставляем старую
    let nextCoverUrl = patch.coverUrl ?? null;

    if (nextAlbumId && nextCoverUrl && nextCoverUrl.startsWith('blob:')) {
      // Если есть альбом и новая обложка — обновляем альбом
      const album = library.getAlbum(nextAlbumId);
      if (album) {
        writer.addOrUpdateAlbum({ ...album, coverUrl: nextCoverUrl });
      }
      nextCoverUrl = null; // В треке не храним
    } else if (nextAlbumId) {
      // Если есть альбом, но новой обложки нет — берем из альбома
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

    metadataPersistenceService.setInMemory(trackId, {
      artist: patch.artist,
      title: patch.title,
      album: patch.album,
      coverUrl: nextCoverUrl,
      similarity: 1,
      provider: 'manual',
    });

    this.scheduleFlush();
    this.saveCacheForTrack(track);
    this.syncPlayerQueue(trackId);
  }

  applyFromFile(trackId: TrackId, parsed: TrackMetadata): void {
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

    this.saveCacheForTrack(track);
    this.syncPlayerQueue(trackId);
  }

  async reset(trackId: TrackId): Promise<void> {
    const library = useLibraryStore();
    const track = library.getTrack(trackId);
    if (!track || !track.raw) return;

    const writer = createLibraryWriter();

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

    this.saveCacheForTrack(track);
    this.syncPlayerQueue(trackId);

    resetProcessedTrack(trackId);
  }

  async resetMany(trackIds: TrackId[]): Promise<void> {
    for (const id of trackIds) {
      await this.reset(id);
    }
  }

  markNotFound(trackId: TrackId): void {
    const track = useLibraryStore().getTrack(trackId);
    if (track?.hasId3Tags) return;

    metadataPersistenceService.setInMemory(trackId, {
      artist: null,
      title: null,
      album: null,
      coverUrl: null,
      similarity: null,
      provider: 'not-found',
    });
    this.scheduleFlush();
  }

  hasEntry(trackId: TrackId): boolean {
    return metadataPersistenceService.has(trackId);
  }

  getEntry(trackId: TrackId) {
    return metadataPersistenceService.get(trackId);
  }

  async flush(): Promise<void> {
    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    await metadataPersistenceService.flush();
  }

  private async markNotFoundAndFlush(trackId: TrackId): Promise<void> {
    this.markNotFound(trackId);
    await this.flush();
  }

  private scheduleFlush(): void {
    if (this.flushTimer !== null) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void metadataPersistenceService.flush();
    }, FLUSH_DEBOUNCE_MS);
  }

  private applyPatch(track: Track, incoming: RemoteTrackMetadata, allowMetadataOverwrite: boolean): void {
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

    this.saveCacheForTrack(track);
  }

  private syncPlayerQueue(trackId: TrackId): void {
    const player = usePlayerStore();
    player.updateTrackInQueue(trackId);
  }

  private saveCacheForTrack(track: Track): void {
    const pluginIds = new Set(track.sources.map((s) => s.pluginId));

    void (async () => {
      for (const pluginId of pluginIds) {
        try {
          const plugin = await loadPlugin(pluginId);
          if (plugin.saveCache) {
            const context = createPluginContext(pluginId);
            await plugin.saveCache(context);
          }
        } catch (err) {
          console.warn(`[metadata] failed to save cache for ${pluginId}`, err);
        }
      }
    })();
  }

  private saveToCache(track: Track, incoming: RemoteTrackMetadata): void {
    metadataPersistenceService.setInMemory(track.id, {
      artist: incoming.artist,
      title: incoming.title,
      album: incoming.album,
      coverUrl: incoming.coverUrl,
      similarity: incoming.similarity,
      provider: incoming.source,
    });
  }

  async fetchCandidates(trackId: TrackId): Promise<MetadataCandidate[]> {
    const library = useLibraryStore();
    const track = library.getTrack(trackId);
    if (!track || !track.title?.trim()) return [];

    try {
      // Запрашиваем с порогом 0, чтобы получить всех кандидатов (даже слабых)
      const result = await trackMetadataService.fetch(track.artist ?? '', track.title, 0);
      if (result.status !== 'found') return [];

      // Если бэкенд вернул массив candidates, используем его
      if (result.data.candidates && result.data.candidates.length > 0) {
        return result.data.candidates.map((c) => ({
          id: newMetadataCandidateId(),
          artist: c.artist ?? '',
          title: c.title ?? '',
          album: c.album ?? '',
          coverUrl: c.coverUrl ?? null,
          similarity: c.similarity,
          provider: c.source,
        }));
      }

      // Если вернул только одного (best), делаем из него массив
      return [
        {
          id: newMetadataCandidateId(),
          artist: result.data.artist,
          title: result.data.title,
          album: result.data.album,
          coverUrl: result.data.coverUrl,
          similarity: result.data.similarity,
          provider: result.data.source,
        },
      ];
    } catch (err) {
      console.warn('[metadata] fetchCandidates failed', err);
      return [];
    }
  }
}

export const metadataService = MetadataService.getInstance();
