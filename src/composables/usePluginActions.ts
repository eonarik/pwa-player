// src/composables/usePluginActions.ts

import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useLibraryStore, createLibraryWriter } from '@/stores/library';
import { loadPlugin } from '@/plugins/registry';
import { createPluginContext } from '@/plugins/context';
import { toastService } from '@/services/ui/ToastService';
import type { PluginManifest } from '@/plugins/types';
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

  async function doOpenPlugin(row: { manifest: PluginManifest }) {
    const { manifest } = row;

    // 1. Если плагин имеет собственный роут (Радио, Подкасты, Звук) —
    // просто переходим на него, не трогая библиотеку папок.
    if (manifest.customRoute) {
      router.push({ name: manifest.customRoute });
      return;
    }

    const plugin = await loadPlugin(manifest.id);
    const context = createPluginContext(manifest.id);
    const writer = createLibraryWriter();

    // 2. Ждем рутовый скан
    const snapshot = await plugin.load(context);
    await writer.setLibrary(snapshot, manifest.id);

    // 3. Ищем корень
    const root = findRoot(manifest.id);
    if (!root) {
      toastService.error(`Источник «${manifest.name}» пуст`);
      return;
    }

    // 4. Переход
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
      void options;
      await doOpenPlugin(row);
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
      await onReload();
    } finally {
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
