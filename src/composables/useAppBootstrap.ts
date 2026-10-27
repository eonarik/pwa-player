// src/composables/useAppBootstrap.ts

import { ref, onMounted } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { useHistoryStore } from '@/stores/history'
import { useDislikesStore } from '@/stores/dislikes'
import { useUiSettingsStore } from '@/stores/uiSettings'
import { useLibraryStore } from '@/stores/library'
import { metadataService } from '@/services/metadata/MetadataService'
import { downloadSpaceService } from '@/services/download/DownloadSpaceService'
import { syncService } from '@/services/download/SyncService'
import { getPlugins, loadPlugin } from '@/plugins/registry'
import { createPluginContext } from '@/plugins/context'
import { sortService } from '@/services/sort/SortService'
import { reconciliationService } from '@/services/library/ReconciliationService'

export function useAppBootstrap() {
  const isBootstrapping = ref(true)

  onMounted(async () => {
    const player = usePlayerStore()
    const history = useHistoryStore()
    const dislikes = useDislikesStore()
    const uiSettings = useUiSettingsStore()
    const library = useLibraryStore()

    try {
      await uiSettings.load()
      await sortService.load()
      await metadataService.flush()
      await downloadSpaceService.load()
      await history.restore()
      await dislikes.restore()

      await library.restoreVirtualTracks()

      if (downloadSpaceService.hasSpace.value && !downloadSpaceService.needsPermission.value) {
        const plugins = getPlugins().filter((p) => p.canDownload)
        for (const p of plugins) {
          void syncService.scanPlugin(p.id)
        }
      }

      for (const manifest of getPlugins()) {
        try {
          const plugin = await loadPlugin(manifest.id)
          const context = createPluginContext(manifest.id)
          const restored = await plugin.restoreFromCache(context)
          if (restored) console.info(`[app] restored source: ${manifest.id}`)
        } catch (err) {
          console.warn(`[app] failed to restore source "${manifest.id}"`, err)
        }
      }

      void reconciliationService.reconcile()

      const playerRestored = await player.restore()
      if (playerRestored) console.log('[player] restored')
    } finally {
      isBootstrapping.value = false
    }
  })

  return { isBootstrapping }
}
