// src/stores/history.ts

import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import { historyPersistenceService } from '@/services/persistence/HistoryPersistenceService';
import type { HistoryCollection } from '@/types/collection';
import type { TrackId } from '@/types/ids';
import { useLibraryStore, createLibraryWriter } from './library';
import { merge, apply } from '@/services/library/TrackMerger';
import type { Track } from '@/types/track';
import { useUiSettingsStore } from './uiSettings';

const HISTORY_MAX_SIZE = 1000;

export const useHistoryStore = defineStore('history', () => {
  const history = ref<HistoryCollection>({
    id: 'collection:history',
    playedAt: {} as Record<TrackId, number>,
  });

  const entries = computed(() => {
    return Object.entries(history.value.playedAt)
      .map(([trackId, playedAt]) => ({ trackId: trackId as TrackId, playedAt }))
      .sort((a, b) => b.playedAt - a.playedAt);
  });

  const sortedHistory = computed(() => entries.value);
  const uniqueHistory = computed(() => entries.value);
  const isEmpty = computed(() => entries.value.length === 0);

  async function restore(): Promise<boolean> {
    const loaded = await historyPersistenceService.load();
    if (loaded) {
      const playedAt: Record<TrackId, number> = {};
      for (const entry of loaded) {
        playedAt[entry.trackId] = entry.playedAt;
      }
      history.value = { id: 'collection:history', playedAt };
      return true;
    }
    return false;
  }

  function save(): void {
    historyPersistenceService.save(entries.value);
  }

  watch(history, () => save(), { deep: true });

  async function flush(): Promise<void> {
    await historyPersistenceService.flush();
  }

  async function recordPlay(track: Track): Promise<void> {
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
            console.warn(`[history] saveCache failed for ${pid}`, err);
          }
        }
      },
    });

    const trackId = mergeResult.track.id;
    history.value.playedAt[trackId] = Date.now();

    // Ограничение размера
    const entriesList: Array<[string, number]> = Object.entries(history.value.playedAt).sort((a, b) => a[1] - b[1]);
    if (entriesList.length > HISTORY_MAX_SIZE) {
      const next: Record<TrackId, number> = {};
      const toKeep = entriesList.slice(entriesList.length - HISTORY_MAX_SIZE);
      for (const [id, ts] of toKeep) {
        next[id as TrackId] = ts;
      }
      history.value.playedAt = next;
    }
  }

  function clear(): void {
    history.value = { id: 'collection:history', playedAt: {} as Record<TrackId, number> };
    void historyPersistenceService.clear();
  }

  function getEntry(trackId: TrackId): { trackId: TrackId; playedAt: number } | null {
    const ts = history.value.playedAt[trackId];
    if (ts === undefined) return null;
    return { trackId, playedAt: ts };
  }

  return {
    history,
    entries,
    sortedHistory,
    uniqueHistory,
    isEmpty,

    restore,
    save,
    recordPlay,
    clear,
    getEntry,
    flush,
  };
});
