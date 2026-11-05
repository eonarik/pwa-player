// src/composables/useFolderSync.ts

import { ref, watch, onUnmounted, type Ref } from 'vue';
import { loadPlugin, pluginIdFromSource } from '@/plugins/registry';
import { createPluginContext } from '@/plugins/context';
import { isScanning as isFolderScanning } from '@/utils/folderStatus';
import { syncService } from '@/services/download/SyncService';
import { toastService } from '@/services/ui/ToastService';
import type { FolderRef } from '@/types/folder';
import type { LibrarySource } from '@/plugins/types';

export interface UseFolderSyncReturn {
  canRefresh: Ref<boolean>;
  canRefreshFromDevice: Ref<boolean>;
  isRefreshing: Ref<boolean>;
  isRefreshingFromDevice: Ref<boolean>;
  isShallowRefreshing: Ref<boolean>;
  isScanning: Ref<boolean>;
  isPluginScanning: Ref<boolean>;
  needsAttention: Ref<boolean>;
  refreshFromCloud: () => Promise<void>;
  refreshFromCloudShallow: () => Promise<void>;
  refreshFromDevice: () => Promise<void>;
}

export function useFolderSync(currentFolder: Ref<FolderRef | null>): UseFolderSyncReturn {
  const canRefresh = ref(false);
  const canRefreshFromDevice = ref(false);
  const isRefreshing = ref(false);
  const isRefreshingFromDevice = ref(false);
  const isShallowRefreshing = ref(false);
  const isScanning = ref(false);
  const isPluginScanning = ref(false);
  const needsAttention = ref(false);

  let pluginScanTimer: ReturnType<typeof setInterval> | null = null;
  let activePlugin: LibrarySource | null = null;

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
      } catch {
        canRefresh.value = false;
        canRefreshFromDevice.value = false;
        isPluginScanning.value = false;
      }
    },
    { immediate: true },
  );

  watch(
    () => currentFolder.value,
    (folder) => {
      if (!folder) {
        isScanning.value = false;
        return;
      }
      isScanning.value = isFolderScanning(folder);
    },
    { immediate: true },
  );

  watch(
    () => currentFolder.value?.pluginId,
    async (pluginId) => {
      if (pluginScanTimer !== null) {
        clearInterval(pluginScanTimer);
        pluginScanTimer = null;
      }
      if (!pluginId) {
        isPluginScanning.value = false;
        activePlugin = null;
        return;
      }
      try {
        activePlugin = await loadPlugin(pluginIdFromSource(pluginId));
        isPluginScanning.value = activePlugin.isScanning?.() ?? false;
        pluginScanTimer = setInterval(() => {
          if (activePlugin) {
            isPluginScanning.value = activePlugin.isScanning?.() ?? false;
          }
        }, 500);
      } catch {
        isPluginScanning.value = false;
        activePlugin = null;
      }
    },
    { immediate: true },
  );

  onUnmounted(() => {
    if (pluginScanTimer !== null) {
      clearInterval(pluginScanTimer);
      pluginScanTimer = null;
    }
    activePlugin = null;
  });

  async function refreshFromCloud(): Promise<void> {
    const folder = currentFolder.value;
    if (!folder) return;

    const pluginId = pluginIdFromSource(folder.pluginId);

    if (isFolderScanning(folder)) {
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
      if (activePlugin) {
        isPluginScanning.value = activePlugin.isScanning?.() ?? false;
      }
    }
  }

  /**
   * Доскан: только текущая папка (без рекурсии), с cleanupSubtree = { folderId }.
   * Добавляет новые файлы/папки, удаляет отсутствующие (только в текущей папке).
   * Также возобновляет очередь pending детей (через ScanQueue).
   */
  async function refreshFromCloudShallow(): Promise<void> {
    const folder = currentFolder.value;
    if (!folder) return;

    const pluginId = pluginIdFromSource(folder.pluginId);

    if (isFolderScanning(folder)) {
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

      isShallowRefreshing.value = true;
      needsAttention.value = false;

      const context = createPluginContext(pluginId);
      await plugin.scanFolder(context, folder.id, { recursive: false, force: true });

      toastService.success('Досканировано');
    } catch (err) {
      console.error('[folder-sync] shallow refresh failed', err);
      needsAttention.value = true;
      toastService.error('Не удалось досканировать');
    } finally {
      isShallowRefreshing.value = false;
      if (activePlugin) {
        isPluginScanning.value = activePlugin.isScanning?.() ?? false;
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
    isShallowRefreshing,
    isScanning,
    isPluginScanning,
    needsAttention,
    refreshFromCloud,
    refreshFromCloudShallow,
    refreshFromDevice,
  };
}
