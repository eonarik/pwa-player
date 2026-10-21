// src/composables/useFolderSync.ts

import { ref, watch, type Ref } from 'vue'
import { loadPlugin, pluginIdFromSource } from '@/plugins/registry'
import { createPluginContext } from '@/plugins/context'
import { syncService } from '@/services/download/SyncService'
import { toastService } from '@/services/ui/ToastService'
import type { Folder } from '@/types/library'

export interface UseFolderSyncReturn {
  canRefresh: Ref<boolean>
  canRefreshFromDevice: Ref<boolean>
  isRefreshing: Ref<boolean>
  isRefreshingFromDevice: Ref<boolean>
  refreshFromCloud: () => Promise<void>
  refreshFromDevice: () => Promise<void>
}

/**
 * Синхронизация текущей папки: с облака (пересканировать поддерево)
 * и с устройства (найти новые/отсутствующие файлы).
 *
 * `canRefresh` / `canRefreshFromDevice` пересчитываются при смене
 * `currentFolder.source`: смотрят на возможности плагина
 * (`scanFolder`, `scanDownloadDir`).
 */
export function useFolderSync(currentFolder: Ref<Folder | null>): UseFolderSyncReturn {
  const canRefresh = ref(false)
  const canRefreshFromDevice = ref(false)
  const isRefreshing = ref(false)
  const isRefreshingFromDevice = ref(false)

  watch(
    () => currentFolder.value?.source,
    async (sourceId) => {
      if (!sourceId) {
        canRefresh.value = false
        canRefreshFromDevice.value = false
        return
      }
      try {
        const plugin = await loadPlugin(pluginIdFromSource(sourceId))
        canRefresh.value = typeof plugin.scanFolder === 'function'
        canRefreshFromDevice.value =
          plugin.canDownload === true && typeof plugin.scanDownloadDir === 'function'
      } catch {
        canRefresh.value = false
        canRefreshFromDevice.value = false
      }
    },
    { immediate: true },
  )

  async function refreshFromCloud(): Promise<void> {
    const folder = currentFolder.value
    if (!folder || !folder.source) return

    try {
      const plugin = await loadPlugin(pluginIdFromSource(folder.source))
      if (!plugin.scanFolder) return

      isRefreshing.value = true
      const context = createPluginContext(pluginIdFromSource(folder.source))
      await plugin.scanFolder(context, folder.id, { recursive: true, removeMissing: true })
      toastService.success('Обновлено с облака')
    } catch (err) {
      console.error('[folder-sync] cloud refresh failed', err)
      toastService.error('Не удалось обновить с облака')
    } finally {
      isRefreshing.value = false
    }
  }

  async function refreshFromDevice(): Promise<void> {
    if (isRefreshingFromDevice.value) return

    isRefreshingFromDevice.value = true
    try {
      await syncService.syncAll()
      toastService.info('Сканирование устройства завершено')
    } catch (err) {
      console.error('[folder-sync] device refresh failed', err)
      toastService.error('Не удалось обновить с устройства')
    } finally {
      isRefreshingFromDevice.value = false
    }
  }

  return {
    canRefresh,
    canRefreshFromDevice,
    isRefreshing,
    isRefreshingFromDevice,
    refreshFromCloud,
    refreshFromDevice,
  }
}
