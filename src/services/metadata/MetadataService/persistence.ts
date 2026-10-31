// src/services/metadata/MetadataService/persistence.ts

import { metadataPersistenceService } from '@/services/persistence/MetadataPersistenceService';
import { useLibraryStore } from '@/stores/library';
import { loadPlugin } from '@/plugins/registry';
import { createPluginContext } from '@/plugins/context';
import type { Track } from '@/types/track';
import type { RemoteTrackMetadata } from '../TrackMetadataService';
import type { TrackId } from '@/types/ids';
import type { ManualPatch } from './types';

const FLUSH_DEBOUNCE_MS = 500;

export function createMetadataPersistence() {
  let flushTimer: ReturnType<typeof setTimeout> | null = null;

  function scheduleFlush(): void {
    if (flushTimer !== null) return;
    flushTimer = setTimeout(() => {
      flushTimer = null;
      void metadataPersistenceService.flush();
    }, FLUSH_DEBOUNCE_MS);
  }

  async function flush(): Promise<void> {
    if (flushTimer !== null) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    await metadataPersistenceService.flush();
  }

  function saveToCache(track: Track, incoming: RemoteTrackMetadata): void {
    metadataPersistenceService.setInMemory(track.id, {
      artist: incoming.artist,
      title: incoming.title,
      album: incoming.album,
      coverUrl: incoming.coverUrl,
      similarity: incoming.similarity,
      provider: incoming.source,
    });
  }

  function setManualInMemory(trackId: TrackId, patch: ManualPatch, coverUrl: string | null): void {
    metadataPersistenceService.setInMemory(trackId, {
      artist: patch.artist,
      title: patch.title,
      album: patch.album,
      coverUrl,
      similarity: 1,
      provider: 'manual',
    });
  }

  function saveCacheForTrack(track: Track): void {
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

  function markNotFound(trackId: TrackId): void {
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
    scheduleFlush();
  }

  function hasEntry(trackId: TrackId): boolean {
    return metadataPersistenceService.has(trackId);
  }

  function getEntry(trackId: TrackId) {
    return metadataPersistenceService.get(trackId);
  }

  return {
    scheduleFlush,
    flush,
    saveToCache,
    setManualInMemory,
    saveCacheForTrack,
    markNotFound,
    hasEntry,
    getEntry,
  };
}

export type MetadataPersistence = ReturnType<typeof createMetadataPersistence>;
