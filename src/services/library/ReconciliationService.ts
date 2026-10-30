// src/services/library/ReconciliationService.ts

import { useLibraryStore } from '@/stores/library';
import { usePlaylistsStore } from '@/stores/playlists';
import { useHistoryStore } from '@/stores/history';
import { useDislikesStore } from '@/stores/dislikes';
import { useUiSettingsStore } from '@/stores/uiSettings';
import { createLibraryWriter } from '@/stores/library';
import { reconcile as mergeReconcile } from './TrackMerger';
import { loadPlugin } from '@/plugins/registry';
import { createPluginContext } from '@/plugins/context';
import type { TrackId } from '@/types/ids';

class ReconciliationService {
  private static instance: ReconciliationService | null = null;
  private isRunning = false;

  static getInstance(): ReconciliationService {
    if (!ReconciliationService.instance) {
      ReconciliationService.instance = new ReconciliationService();
    }
    return ReconciliationService.instance;
  }

  async reconcile(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      const library = useLibraryStore();
      const playlists = usePlaylistsStore();
      const history = useHistoryStore();
      const dislikes = useDislikesStore();
      const uiSettings = useUiSettingsStore();
      const writer = createLibraryWriter();

      await mergeReconcile({
        writer,
        threshold: uiSettings.playlistMatchThreshold,
        replaceTrackId: async (oldId: TrackId, newId: TrackId) => {
          // Плейлисты
          for (const playlist of Object.values(playlists.playlists)) {
            const idx = playlist.trackIds.indexOf(oldId);
            if (idx !== -1) {
              playlist.trackIds[idx] = newId;
              playlist.trackIds = Array.from(new Set(playlist.trackIds));
              playlist.updatedAt = Date.now();
            }
          }
          playlists.save();

          // История
          const historyTs = history.history.playedAt[oldId];
          if (historyTs !== undefined) {
            if (history.history.playedAt[newId] === undefined) {
              history.history.playedAt[newId] = historyTs;
            }
            delete history.history.playedAt[oldId];
          }

          // Дизлайки
          const dislikeTs = dislikes.dislikes.dislikedAt[oldId];
          if (dislikeTs !== undefined) {
            if (dislikes.dislikes.dislikedAt[newId] === undefined) {
              dislikes.dislikes.dislikedAt[newId] = dislikeTs;
            }
            delete dislikes.dislikes.dislikedAt[oldId];
          }

          // Force-save (не обязательно, watch сделает)
          void library;
        },
        saveCache: async (pluginId: string) => {
          if (!pluginId) return;
          try {
            const plugin = await loadPlugin(pluginId);
            if (plugin.saveCache) {
              const context = createPluginContext(pluginId);
              await plugin.saveCache(context);
            }
          } catch (err) {
            console.warn(`[reconcile] failed to save cache for ${pluginId}`, err);
          }
        },
      });
    } catch (err) {
      console.error('[reconciliation] failed', err);
    } finally {
      this.isRunning = false;
    }
  }
}

export const reconciliationService = ReconciliationService.getInstance();
