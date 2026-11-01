// src/composables/useFolderSync.ts

import { ref, watch, type Ref } from 'vue';
import { loadPlugin, pluginIdFromSource } from '@/plugins/registry';
import { createPluginContext } from '@/plugins/context';
import { folderStatusService } from '@/services/folders/FolderStatusService';
import { syncService } from '@/services/download/SyncService';
import { toastService } from '@/services/ui/ToastService';
import type { FolderRef } from '@/types/folder';

export interface UseFolderSyncReturn {
  canRefresh: Ref<boolean>;
  canRefreshFromDevice: Ref<boolean>;
  isRefreshing: Ref<boolean>;
  isRefreshingFromDevice: Ref<boolean>;
  isScanning: Ref<boolean>;
  isPluginScanning: Ref<boolean>;
  needsAttention: Ref<boolean>;
  refreshFromCloud: () => Promise<void>;
  refreshFromDevice: () => Promise<void>;
}

export function useFolderSync(currentFolder: Ref<FolderRef | null>): UseFolderSyncReturn {
  const canRefresh = ref(false);
  const canRefreshFromDevice = ref(false);
  const isRefreshing = ref(false);
  const isRefreshingFromDevice = ref(false);
  const isScanning = ref(false);
  const isPluginScanning = ref(false);
  const needsAttention = ref(false);

  watch(
    () => currentFolder.value?.pluginId,
    async (pluginId) => {
      needsAttention.value = false;
      if (!pluginId) {
        canRefresh.value = false;
        canRefreshFromDevice.value = false;
        isPluginScanning.value = false;
        return;
      }
      try {
        const plugin = await loadPlugin(pluginIdFromSource(pluginId));
        canRefresh.value = typeof plugin.scanFolder === 'function';
        canRefreshFromDevice.value = plugin.canDownload === true && typeof plugin.scanDownloadDir === 'function';
        // Проверяем, сканирует ли плагин сейчас
        isPluginScanning.value = plugin.isScanning?.() ?? false;
      } catch {
        canRefresh.value = false;
        canRefreshFromDevice.value = false;
        isPluginScanning.value = false;
      }
    },
    { immediate: true },
  );

  watch(
    () => currentFolder.value?.id,
    (folderId) => {
      if (!folderId) {
        isScanning.value = false;
        return;
      }
      isScanning.value = folderStatusService.isScanning(folderId);
    },
    { immediate: true },
  );

  async function refreshFromCloud(): Promise<void> {
    const folder = currentFolder.value;
    if (!folder) return;

    const pluginId = pluginIdFromSource(folder.pluginId);

    if (folderStatusService.isScanning(folder.id)) {
      toastService.info('Папка уже синхронизируется. Дождитесь завершения.');
      return;
    }

    try {
      const plugin = await loadPlugin(pluginId);

      if (plugin.isDisconnected?.()) {
        toastService.info('Подключение к источнику...');
        const context = createPluginContext(pluginId);
        await plugin.connect(context);
      }
      if (!plugin.scanFolder) return;

      if (plugin.canForceScan && !plugin.canForceScan(folder.id)) {
        toastService.info('Папка уже синхронизируется. Дождитесь завершения.');
        return;
      }

      isRefreshing.value = true;
      needsAttention.value = false;

      const context = createPluginContext(pluginId);
      await plugin.scanFolder(context, folder.id, { recursive: true, force: true });

      toastService.success('Обновлено с облака');
    } catch (err) {
      console.error('[folder-sync] cloud refresh failed', err);
      needsAttention.value = true;
      toastService.error('Не удалось обновить с облака. Требуется ручная синхронизация.');
    } finally {
      isRefreshing.value = false;
      // Обновляем флаг сканирования после завершения
      try {
        const p = await loadPlugin(pluginId);
        isPluginScanning.value = p.isScanning?.() ?? false;
      } catch {
        // ignore
      }
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
    isScanning,
    isPluginScanning,
    needsAttention,
    refreshFromCloud,
    refreshFromDevice,
  };
}
