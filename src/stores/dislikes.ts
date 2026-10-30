// src/stores/dislikes.ts

import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import { dislikesPersistenceService } from '@/services/persistence/DislikesPersistenceService';
import type { DislikesCollection } from '@/types/collection';
import type { TrackId } from '@/types/ids';
import { useLibraryStore } from './library';
import { createLibraryWriter } from './library';
import { merge, apply } from '@/services/library/TrackMerger';
import type { Track } from '@/types/track';
import { useUiSettingsStore } from './uiSettings';

export const useDislikesStore = defineStore('dislikes', () => {
  const dislikes = ref<DislikesCollection>({
    id: 'collection:dislikes',
    dislikedAt: {} as Record<TrackId, number>,
  });

  const entries = computed(() => {
    return Object.entries(dislikes.value.dislikedAt)
      .map(([trackId, dislikedAt]) => ({ trackId: trackId as TrackId, dislikedAt }))
      .sort((a, b) => b.dislikedAt - a.dislikedAt);
  });

  const sortedEntries = computed(() => entries.value);
  const dislikedIds = computed(() => new Set(Object.keys(dislikes.value.dislikedAt) as TrackId[]));

  async function restore(): Promise<boolean> {
    const loaded = await dislikesPersistenceService.load();
    if (loaded) {
      const dislikedAt: Record<TrackId, number> = {};
      for (const entry of loaded) {
        dislikedAt[entry.trackId] = entry.dislikedAt;
      }
      dislikes.value = { id: 'collection:dislikes', dislikedAt };
      return true;
    }
    return false;
  }

  function save(): void {
    dislikesPersistenceService.save(entries.value);
  }

  watch(dislikes, () => save(), { deep: true });

  async function flush(): Promise<void> {
    await dislikesPersistenceService.flush();
  }

  function isDisliked(trackId: TrackId): boolean {
    return dislikedIds.value.has(trackId);
  }

  async function dislike(track: Track): Promise<void> {
    const library = useLibraryStore();
    const uiSettings = useUiSettingsStore();
    const writer = createLibraryWriter();

    const incoming = {
      artist: track.artist,
      title: track.title,
      album: track.raw?.album ?? '',
      coverUrl: track.coverUrl,
      duration: track.duration,
      codec: track.codec,
      hasId3Tags: track.hasId3Tags,
      source: track.sources[0]!,
    };

    const mergeResult = merge(incoming, {
      existingTracks: Object.values(library.tracks),
      existingAlbums: Object.values(library.albums),
      threshold: uiSettings.playlistMatchThreshold,
    });

    await apply(mergeResult, {
      writer,
      saveCache: async () => {
        const pid = mergeResult.track.sources[0]?.pluginId;
        if (pid) {
          const { loadPlugin } = await import('@/plugins/registry');
          const { createPluginContext } = await import('@/plugins/context');
          try {
            const plugin = await loadPlugin(pid);
            if (plugin.saveCache) {
              await plugin.saveCache(createPluginContext(pid));
            }
          } catch (err) {
            console.warn(`[dislikes] saveCache failed for ${pid}`, err);
          }
        }
      },
    });

    const trackId = mergeResult.track.id;
    if (isDisliked(trackId)) return;
    dislikes.value.dislikedAt[trackId] = Date.now();
  }

  function undislike(trackId: TrackId): void {
    delete dislikes.value.dislikedAt[trackId];
  }

  async function toggleDislike(track: Track): Promise<boolean> {
    if (isDisliked(track.id)) {
      undislike(track.id);
      return false;
    }
    await dislike(track);
    return true;
  }

  function clear(): void {
    dislikes.value = {
      id: 'collection:dislikes',
      dislikedAt: {} as Record<TrackId, number>,
    };
    void dislikesPersistenceService.clear();
  }

  return {
    dislikes,
    entries,
    sortedEntries,
    dislikedIds,

    restore,
    save,
    isDisliked,
    dislike,
    undislike,
    toggleDislike,
    clear,
    flush,
  };
});
