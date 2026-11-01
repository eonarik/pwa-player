// src/composables/useAppBootstrap.ts

import { ref, onMounted, unref } from 'vue';
import { usePlayerStore } from '@/stores/player';
import { useHistoryStore } from '@/stores/history';
import { useDislikesStore } from '@/stores/dislikes';
import { useUiSettingsStore } from '@/stores/uiSettings';
import { useLibraryStore } from '@/stores/library';
import { usePlaylistsStore } from '@/stores/playlists';
import { metadataService } from '@/services/metadata/MetadataService';
import { downloadSpaceService } from '@/services/download/DownloadSpaceService';
import { syncService } from '@/services/download/SyncService';
import { getPlugins, loadPlugin } from '@/plugins/registry';
import { createPluginContext } from '@/plugins/context';
import { sortService } from '@/services/sort/SortService';
import { reconciliationService } from '@/services/library/ReconciliationService';

export function useAppBootstrap() {
  const isBootstrapping = ref(true);

  onMounted(async () => {
    const player = usePlayerStore();
    const history = useHistoryStore();
    const dislikes = useDislikesStore();
    const uiSettings = useUiSettingsStore();
    const library = useLibraryStore();
    const playlists = usePlaylistsStore();

    try {
      await uiSettings.load();
      await sortService.load();
      await metadataService.flush();
      await downloadSpaceService.load();
      await history.restore();
      await dislikes.restore();
      await playlists.restore();

      await library.restore();

      // Синхронизация folder.trackIds ↔ sources — до orphan-cleanup.
      library.reconcileFolderTrackIds();

      if (downloadSpaceService.hasSpace.value && !downloadSpaceService.needsPermission.value) {
        const plugins = getPlugins().filter((p) => p.canDownload);
        for (const p of plugins) {
          void syncService.scanPlugin(p.id);
        }
      }

      for (const manifest of getPlugins()) {
        try {
          const plugin = await loadPlugin(manifest.id);
          const context = createPluginContext(manifest.id);
          const restored = await plugin.restoreFromCache(context);
          if (restored) {
            console.info(`[app] restored source: ${manifest.id}`);
          } else if (!manifest.isStateless && !plugin.isDisconnected?.()) {
            // Плагин не восстановился из кеша — вызываем load() для получения структуры.
            // Только если плагин подключён (isDisconnected === false) — иначе нет смысла
            // дёргать API (401) и засорять requests в тестах.
            try {
              const snapshot = await plugin.load(context);
              if (snapshot.folders.length > 0 || snapshot.tracks.length > 0) {
                await context.writer.setLibrary(snapshot, manifest.id);
              }
            } catch (err) {
              console.warn(`[app] failed to load source "${manifest.id}"`, err);
            }
          }
        } catch (err) {
          console.warn(`[app] failed to restore source "${manifest.id}"`, err);
        }
      }

      void reconciliationService.reconcile();
      library.cleanupOrphanAlbums();

      const playerRestored = await player.restore();
      if (playerRestored) console.log('[player] restored');

      library.cleanupOrphanTracks(
        unref(playlists.playlists) ?? {},
        unref(history.history) ?? { playedAt: {} },
        unref(dislikes.dislikes) ?? { dislikedAt: {} },
        unref(player.queue) ?? [],
      );
    } finally {
      isBootstrapping.value = false;
    }
  });

  return { isBootstrapping };
}
