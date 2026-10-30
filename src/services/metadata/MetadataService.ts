// src/services/metadata/MetadataService.ts

import { metadataPersistenceService } from '@/services/persistence/MetadataPersistenceService';
import { useLibraryStore, createLibraryWriter } from '@/stores/library';
import { loadPlugin } from '@/plugins/registry';
import { createPluginContext } from '@/plugins/context';
import { resolveAlbumByName } from '@/services/library/EntityGraph';
import type { Track } from '@/types/track';
import type { MetadataCandidate } from '@/types/metadata';
import type { TrackMetadata } from './types';
import type { RemoteTrackMetadata } from './TrackMetadataService';
import type { TrackId } from '@/types/ids';
import { newMetadataCandidateId } from '@/types/ids';

export type ApplyResult =
  { status: 'applied' } | { status: 'candidates' } | { status: 'skipped'; reason: 'not-found' | 'protected' };

export interface ManualPatch {
  artist: string;
  title: string;
  album: string;
  coverUrl: string | undefined;
}

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

  applyRemote(trackId: TrackId, incoming: RemoteTrackMetadata): ApplyResult {
    const library = useLibraryStore();
    const track = library.getTrack(trackId);
    if (!track) return { status: 'skipped', reason: 'not-found' };

    if (track.hasId3Tags) {
      return { status: 'skipped', reason: 'protected' };
    }

    this.saveToCache(track, incoming);

    if (incoming.confident) {
      this.applyPatch(track, incoming);
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

    writer.updateTrackMetadata(trackId, {
      artist: patch.artist,
      title: patch.title,
      albumId: nextAlbumId,
      coverUrl: nextAlbumId ? null : (patch.coverUrl ?? null),
      metadataCandidates: [],
    });

    metadataPersistenceService.setInMemory(trackId, {
      artist: patch.artist,
      title: patch.title,
      album: patch.album,
      coverUrl: patch.coverUrl ?? null,
      similarity: 1,
      provider: 'manual',
    });

    this.scheduleFlush();
    this.saveCacheForTrack(track);
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
    });

    this.saveCacheForTrack(track);
  }

  async reset(trackId: TrackId): Promise<void> {
    const library = useLibraryStore();
    const track = library.getTrack(trackId);
    if (!track || !track.raw) return;

    const writer = createLibraryWriter();

    const albumRes = resolveAlbumByName(
      track.raw.album,
      track.raw.artist,
      track.raw.coverUrl,
      Object.values(library.albums),
    );

    const nextAlbumId = albumRes?.album.id ?? null;

    if (albumRes?.album) {
      writer.addOrUpdateAlbum(albumRes.album);
    }

    writer.updateTrackMetadata(trackId, {
      artist: track.raw.artist,
      title: track.raw.title,
      albumId: nextAlbumId,
      coverUrl: nextAlbumId ? null : track.raw.coverUrl,
      metadataCandidates: [],
    });

    await this.markNotFoundAndFlush(trackId);
    this.saveCacheForTrack(track);
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

  private applyPatch(
    track: Track,
    incoming: { artist: string; title: string; album: string; coverUrl: string | null },
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

    writer.updateTrackMetadata(track.id, {
      artist: incoming.artist || track.artist,
      title: incoming.title || track.title,
      albumId: nextAlbumId,
      coverUrl: nextAlbumId ? null : incoming.coverUrl,
    });

    this.saveCacheForTrack(track);
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
}

export const metadataService = MetadataService.getInstance();
