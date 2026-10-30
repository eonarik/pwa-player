// src/composables/useFolderSync.ts

import { ref, watch, type Ref } from 'vue';
import { loadPlugin, pluginIdFromSource } from '@/plugins/registry';
import { createPluginContext } from '@/plugins/context';
import { syncService } from '@/services/download/SyncService';
import { toastService } from '@/services/ui/ToastService';
import type { FolderRef } from '@/types/folder';

export interface UseFolderSyncReturn {
  canRefresh: Ref<boolean>;
  canRefreshFromDevice: Ref<boolean>;
  isRefreshing: Ref<boolean>;
  isRefreshingFromDevice: Ref<boolean>;
  needsAttention: Ref<boolean>;
  refreshFromCloud: () => Promise<void>;
  refreshFromDevice: () => Promise<void>;
}

export function useFolderSync(currentFolder: Ref<FolderRef | null>): UseFolderSyncReturn {
  const canRefresh = ref(false);
  const canRefreshFromDevice = ref(false);
  const isRefreshing = ref(false);
  const isRefreshingFromDevice = ref(false);
  const needsAttention = ref(false);

  /**
   * Пересчитываем возможности плагина при смене папки/плагина.
   */
  watch(
    () => currentFolder.value?.pluginId,
    async (pluginId) => {
      needsAttention.value = false;
      if (!pluginId) {
        canRefresh.value = false;
        canRefreshFromDevice.value = false;
        return;
      }
      try {
        const plugin = await loadPlugin(pluginIdFromSource(pluginId));
        canRefresh.value = typeof plugin.scanFolder === 'function';
        canRefreshFromDevice.value = plugin.canDownload === true && typeof plugin.scanDownloadDir === 'function';
      } catch {
        canRefresh.value = false;
        canRefreshFromDevice.value = false;
      }
    },
    { immediate: true },
  );

  /**
   * Ручное обновление с облака.
   *
   * Отличие от фонового скана: пользователь нажал «Обновить», значит:
   * - хотим видеть локальный индикатор в меню (`isRefreshing`);
   * - не хотим перезапускать весь рекурсивный обход по всем папкам —
   *   только текущую папку и её поддерево.
   *
   * `scanFolder(recursive: true)` сам выставит статусы `scanning → scanned`
   * через progress, а также сохранит библиотеку через `context.writer.setLibrary`.
   */
  async function refreshFromCloud(): Promise<void> {
    const folder = currentFolder.value;
    if (!folder) return;

    const pluginId = pluginIdFromSource(folder.pluginId);

    try {
      const plugin = await loadPlugin(pluginId);

      if (plugin.isDisconnected?.()) {
        toastService.info('Подключение к источнику...');
        const context = createPluginContext(pluginId);
        await plugin.connect(context);
      }
      if (!plugin.scanFolder) return;

      isRefreshing.value = true;
      needsAttention.value = false;

      const context = createPluginContext(pluginId);
      await plugin.scanFolder(context, folder.id, { recursive: true });

      toastService.success('Обновлено с облака');
    } catch (err) {
      console.error('[folder-sync] cloud refresh failed', err);
      needsAttention.value = true;
      toastService.error('Не удалось обновить с облака. Требуется ручная синхронизация.');
    } finally {
      isRefreshing.value = false;
    }
  }

  async function refreshFromDevice(): Promise<void> {
    if (isRefreshingFromDevice.value) return;
    isRefreshingFromDevice.value = true;
    needsAttention.value = false;
    try {
      await syncService.syncAll();
      if (syncService.issueCount.value > 0) {
        toastService.info('Найдены расхождения. Проверьте, что добавить или пометить как «в облаке».');
      } else {
        toastService.info('Сканирование устройства завершено');
      }
    } catch (err) {
      console.error('[folder-sync] device refresh failed', err);
      needsAttention.value = true;
      toastService.error('Не удалось обновить с устройства.');
    } finally {
      isRefreshingFromDevice.value = false;
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
  };
}
