<!-- src/components/library/FolderList.vue -->

<script setup lang="ts">
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useLibraryStore } from '@/stores/library';
import { usePlayerStore } from '@/stores/player';
import { folderStatusService } from '@/services/folders/FolderStatusService';
import { loadPlugin, pluginIdFromSource } from '@/plugins/registry';
import { createPluginContext } from '@/plugins/context';
import { toastService } from '@/services/ui/ToastService';
import FolderListItem from './FolderListItem.vue';
import type { FolderRef } from '@/types/folder';

const router = useRouter();
const library = useLibraryStore();
const player = usePlayerStore();
const { currentSubfolders } = storeToRefs(library);

/**
 * Открытие папки.
 *
 * Если папка pending — сначала запускаем поверхностный скан (1 уровень),
 * потом переходим внутрь. Если scanning — просто переходим (внутри
 * FolderListItem уже крутится спиннер, скан идёт фоном).
 * Если scanned — просто переходим.
 */
async function openFolder(folder: FolderRef): Promise<void> {
  const pluginId = pluginIdFromSource(folder.pluginId);

  // pending → скан 1 уровня перед переходом
  if (folderStatusService.needsScan(folder.id)) {
    try {
      const plugin = await loadPlugin(pluginId);
      if (plugin.scanFolder) {
        const context = createPluginContext(pluginId);
        // scanFolder сам выставит scanning → scanned через progress в плагине.
        await plugin.scanFolder(context, folder.id, { recursive: false });
      }
    } catch (err) {
      console.warn('[FolderList] failed to scan pending folder', err);
      // Не блокируем переход — внутри пользователь увидит «Ошибка синхронизации»
      // и кнопку «Обновить».
    }
  }

  router.push({
    name: 'folder',
    params: {
      pluginId: folder.pluginId,
      path: folder.urlPath ? folder.urlPath.split('/') : [],
    },
  });
}

async function retryFolder(folder: FolderRef): Promise<void> {
  const pluginId = pluginIdFromSource(folder.pluginId);
  try {
    const plugin = await loadPlugin(pluginId);
    if (!plugin.scanFolder) return;
    const context = createPluginContext(pluginId);
    await plugin.scanFolder(context, folder.id, { recursive: true });
  } catch (err) {
    console.error('[FolderList] retry failed', err);
    toastService.error('Не удалось обновить папку');
  }
}

async function playFolder(folder: FolderRef): Promise<void> {
  // Играем только если папка отсканирована (иначе кнопка Play не показывается)
  if (!folderStatusService.isScanned(folder.id)) return;

  const ids = library.tracksByFolderId[folder.id] ?? [];
  if (ids.length === 0) return;
  const tracks = ids.map((id) => library.getTrack(id)).filter((t): t is NonNullable<typeof t> => Boolean(t));
  if (tracks.length === 0) return;
  player.playAll(tracks);
}
</script>

<template>
  <div v-if="currentSubfolders.length > 0" class="flex flex-col gap-0.5">
    <FolderListItem
      v-for="folder in currentSubfolders"
      :key="folder.id"
      :folder="folder"
      @open="openFolder"
      @play="playFolder"
      @retry="retryFolder"
    />
  </div>
</template>
