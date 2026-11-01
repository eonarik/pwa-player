// src/composables/usePluginActions.ts

import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useLibraryStore, createLibraryWriter } from '@/stores/library';
import { usePlayerStore } from '@/stores/player';
import { loadPlugin, pluginIdFromSource } from '@/plugins/registry';
import { createPluginContext } from '@/plugins/context';
import { toastService } from '@/services/ui/ToastService';
import { audioService } from '@/services/audio/AudioService';
import type { PluginManifest, PluginSnapshot } from '@/plugins/types';
import type { FolderRef } from '@/types/folder';

export interface OpenPluginOptions {
  localOnly?: boolean;
}

export function usePluginActions({ onReload }: { onReload: () => Promise<void> }) {
  const router = useRouter();
  const library = useLibraryStore();
  const isLoading = ref<string | null>(null);

  function findRoot(sourceId: string): FolderRef | undefined {
    return Object.values(library.folders).find((f) => f.pluginId === sourceId && f.parentId === null);
  }

  async function doOpenPlugin(row: { manifest: PluginManifest }, options?: OpenPluginOptions) {
    const { manifest } = row;
    if (manifest.customRoute) {
      router.push({ name: manifest.customRoute });
      return;
    }

    const plugin = await loadPlugin(manifest.id);
    const context = createPluginContext(manifest.id);
    const writer = createLibraryWriter();

    let snapshot: PluginSnapshot | null = null;

    // Если это "Открыть локально" и плагин умеет восстанавливаться из файлов
    if (options?.localOnly && plugin.restoreFromLocalFiles) {
      snapshot = await plugin.restoreFromLocalFiles(context);
    }

    // Если не удалось восстановить локально (или это обычное открытие) — загружаем через API
    if (!snapshot) {
      snapshot = await plugin.load(context);
    }

    await writer.setLibrary(snapshot, manifest.id);

    const root = findRoot(manifest.id);
    if (!root) {
      toastService.error(`Источник «${manifest.name}» пуст`);
      return;
    }

    router.push({
      name: 'folder',
      params: {
        pluginId: manifest.id,
        path: root.urlPath ? root.urlPath.split('/') : [],
      },
    });
  }

  async function openPlugin(row: { manifest: PluginManifest }, options?: OpenPluginOptions) {
    if (isLoading.value) return;
    isLoading.value = row.manifest.id;
    try {
      await doOpenPlugin(row, options);
    } finally {
      isLoading.value = null;
    }
  }

  async function connectPlugin(row: { manifest: PluginManifest }) {
    if (isLoading.value) return;
    isLoading.value = row.manifest.id;
    try {
      const plugin = await loadPlugin(row.manifest.id);
      const context = createPluginContext(row.manifest.id);
      await plugin.connect(context);
      toastService.success(`Источник «${row.manifest.name}» подключён`);
      await onReload();
      await doOpenPlugin(row);
    } catch (err) {
      if (err instanceof Error && (err.message === 'cancelled' || err.message === 'redirect')) return;
      toastService.error(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      isLoading.value = null;
    }
  }

  async function disconnectPlugin(row: { manifest: PluginManifest }) {
    if (isLoading.value) return;
    isLoading.value = row.manifest.id;
    try {
      const plugin = await loadPlugin(row.manifest.id);
      await plugin.disconnect(createPluginContext(row.manifest.id));

      // Останавливаем плеер, если текущий трек был из этого плагина.
      const player = usePlayerStore();
      const currentPluginId = player.currentTrack?.sources[0]?.pluginId;
      const wasCurrentFromPlugin =
        currentPluginId !== undefined && pluginIdFromSource(currentPluginId) === row.manifest.id;

      player.removeTracksByPlugin(row.manifest.id);

      // Если текущий трек затронут (или очередь опустела) — освобождаем File/objectURL
      // в AudioService. removeTracksByPlugin мог уже вызвать stop(), но гарантируем.
      if (wasCurrentFromPlugin || player.queue.length === 0) {
        audioService.releaseCurrent();
      }
    } catch (err) {
      console.error('[plugin-actions] disconnect failed', err);
      toastService.error(err instanceof Error ? err.message : 'Не удалось отключить источник');
    } finally {
      // Всегда перечитываем список плагинов — даже при ошибке.
      try {
        await onReload();
      } catch (reloadErr) {
        console.warn('[plugin-actions] onReload after disconnect failed', reloadErr);
      }
      isLoading.value = null;
    }
  }

  return {
    isLoading,
    isOpening: (id: string) => isLoading.value === id,
    openPlugin,
    connectPlugin,
    disconnectPlugin,
  };
}
