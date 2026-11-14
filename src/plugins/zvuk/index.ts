// src/plugins/zvuk/index.ts

import type { LibrarySource, PluginContext, PluginSnapshot, FetchedMetadata, SearchCandidate } from '../types';
import type { TrackSource } from '@/types/track';
import type { TrackId } from '@/types/ids';
import { newTrackSourceId } from '@/types/ids';
import { useLibraryStore, createLibraryWriter } from '@/stores/library';
import { pluginIdFromSource } from '@/plugins/registry';
import { zvukService } from './ZvukService';
import { logger } from '@/utils/logger';

const ZVUK_PLUGIN_ID = 'zvuk';
const ZVUK_SOURCE_PRIORITY = 30;

const zvukPlugin: LibrarySource = {
  id: ZVUK_PLUGIN_ID,
  name: 'СберЗвук',
  icon: '🎵',
  canDownload: false,
  isAvailable: () => true,

  async connect(_context: PluginContext): Promise<void> {
    // Stateless
  },

  async load(_context: PluginContext): Promise<PluginSnapshot> {
    return { folders: [], tracks: [] };
  },

  async restoreFromCache(_context: PluginContext): Promise<PluginSnapshot | null> {
    return null;
  },

  buildStreamUrl(source: TrackSource): string {
    if (source.kind !== 'streaming') {
      throw new Error('[zvuk] buildStreamUrl: source must be streaming');
    }
    return source.url;
  },

  async searchTracks(query: string): Promise<SearchCandidate[]> {
    const results = await zvukService.search(query, ['tracks']);
    return results.tracks.map((t) => ({
      pluginId: ZVUK_PLUGIN_ID,
      trackId: t.id,
      artist: t.artists.map((a) => a.title).join(', ') || 'Unknown',
      title: t.title,
      album: t.release?.title ?? undefined,
      durationMs: t.duration * 1000,
      coverUrl: t.release?.image?.src ?? null,
    }));
  },

  async fetchAudioBlob(candidate: SearchCandidate): Promise<Blob | null> {
    // Кандидат должен принадлежать этому плагину.
    if (candidate.pluginId !== ZVUK_PLUGIN_ID) return null;

    try {
      const url = `/api/zvuk/stream?id=${encodeURIComponent(candidate.trackId)}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      return await res.blob();
    } catch (err) {
      logger.warn('[zvuk] fetchAudioBlob failed', err);
      return null;
    }
  },

  async disconnect(_context: PluginContext): Promise<void> {
    // Stateless
  },

  async fetchMetadata(artist: string, title: string): Promise<FetchedMetadata | null> {
    try {
      const params = new URLSearchParams();
      if (artist) params.set('artist', artist);
      params.set('title', title);

      const res = await fetch(`/api/zvuk/metadata?${params.toString()}`);

      if (res.status === 429) {
        throw new Error('ZVUK_RATE_LIMIT');
      }
      if (!res.ok) return null;

      const data = (await res.json()) as (FetchedMetadata & { trackId?: string }) | null;
      if (!data) return null;

      return {
        artist: data.artist,
        title: data.title,
        album: data.album,
        coverUrl: data.coverUrl,
        source: data.source,
        similarity: data.similarity,
        confident: data.confident,
        extMetadata: data.trackId ? { trackId: data.trackId } : undefined,
      };
    } catch (err) {
      if (err instanceof Error && err.message === 'ZVUK_RATE_LIMIT') {
        throw err; // пробрасываем для restoreUnavailable
      }
      logger.warn('[zvuk] failed to fetch metadata', err);
      return null;
    }
  },

  async applyCandidate(trackId: TrackId, extMetadata: Record<string, unknown>): Promise<void> {
    const zvukTrackId = typeof extMetadata.trackId === 'string' ? extMetadata.trackId : undefined;
    if (!zvukTrackId) return;

    const library = useLibraryStore();
    const track = library.getTrack(trackId);
    if (!track) return;

    const hasZvuk = track.sources.some((s) => pluginIdFromSource(s.pluginId) === ZVUK_PLUGIN_ID);
    if (hasZvuk) return;

    const newSource = {
      id: newTrackSourceId(),
      pluginId: ZVUK_PLUGIN_ID,
      priority: ZVUK_SOURCE_PRIORITY,
      kind: 'streaming' as const,
      url: `/api/zvuk/stream?id=${encodeURIComponent(zvukTrackId)}`,
    };

    const nextSources = [...track.sources, newSource].sort((a, b) => a.priority - b.priority);

    const writer = createLibraryWriter();
    writer.updateTrackSources(trackId, nextSources);
  },
};

export default zvukPlugin;
