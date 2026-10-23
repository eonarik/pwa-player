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
  needsAttention: Ref<boolean>
  refreshFromCloud: () => Promise<void>
  refreshFromDevice: () => Promise<void>
}

export function useFolderSync(currentFolder: Ref<Folder | null>): UseFolderSyncReturn {
  const canRefresh = ref(false)
  const canRefreshFromDevice = ref(false)
  const isRefreshing = ref(false)
  const isRefreshingFromDevice = ref(false)
  const needsAttention = ref(false)

  watch(
    () => currentFolder.value?.source,
    async (sourceId) => {
      needsAttention.value = false
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

      if (plugin.isDisconnected?.()) {
        toastService.info('Подключение к источнику...')
        const context = createPluginContext(pluginIdFromSource(folder.source))
        await plugin.connect(context)
      }

      if (!plugin.scanFolder) return

      isRefreshing.value = true
      needsAttention.value = false
      const context = createPluginContext(pluginIdFromSource(folder.source))

      // 1. Локальные origin/source — до облачного скана.
      if (plugin.mergeLocalIntoLibrary) {
        try {
          await plugin.mergeLocalIntoLibrary(context)
        } catch (err) {
          console.warn('[folder-sync] mergeLocalIntoLibrary (pre) failed', err)
        }
      }

      // 2. Облачный скан.
      await plugin.scanFolder(context, folder.id, { recursive: true, removeMissing: true })

      // 3. Ещё раз — для новых облачных треков с локальной копией.
      if (plugin.mergeLocalIntoLibrary) {
        try {
          await plugin.mergeLocalIntoLibrary(context)
        } catch (err) {
          console.warn('[folder-sync] mergeLocalIntoLibrary (post) failed', err)
        }
      }

      // 4. Сохраняем кеш.
      if (plugin.saveCache) {
        try {
          await plugin.saveCache(context)
        } catch (err) {
          console.warn('[folder-sync] saveCache failed', err)
        }
      }

      toastService.success('Обновлено с облака')
    } catch (err) {
      console.error('[folder-sync] cloud refresh failed', err)
      needsAttention.value = true
      toastService.error('Не удалось обновить с облака. Требуется ручная синхронизация.')
    } finally {
      isRefreshing.value = false
    }
  }

  async function refreshFromDevice(): Promise<void> {
    if (isRefreshingFromDevice.value) return

    isRefreshingFromDevice.value = true
    needsAttention.value = false
    try {
      await syncService.syncAll()
      if (syncService.issueCount.value > 0) {
        toastService.info(
          'Найдены расхождения. Проверьте, что добавить или пометить как «в облаке».',
        )
      } else {
        toastService.info('Сканирование устройства завершено')
      }
    } catch (err) {
      console.error('[folder-sync] device refresh failed', err)
      needsAttention.value = true
      toastService.error('Не удалось обновить с устройства.')
    } finally {
      isRefreshingFromDevice.value = false
    }
  }

  return {
    canRefresh,
    canRefreshFromDevice,
    isRefreshing,
    isRefreshingFromDevice,
    needsAttention,
    refreshFromCloud,
    refreshFromDevice,
  }
}
