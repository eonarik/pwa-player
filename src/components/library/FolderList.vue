<!-- src/components/library/FolderList.vue -->

<script setup lang="ts">
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useLibraryStore } from '@/stores/library';
import { usePlayerStore } from '@/stores/player';
import { needsScan, isError, isScanned } from '@/utils/folderStatus';
import { urlPathToSegments } from '@/utils/urlPath';
import { loadPlugin, pluginIdFromSource } from '@/plugins/registry';
import { createPluginContext } from '@/plugins/context';
import { toastService } from '@/services/ui/ToastService';
import FolderListItem from './FolderListItem.vue';
import type { FolderRef } from '@/types/folder';

const router = useRouter();
const library = useLibraryStore();
const player = usePlayerStore();
const { currentSubfolders } = storeToRefs(library);

async function openFolder(folder: FolderRef): Promise<void> {
  const pluginId = pluginIdFromSource(folder.pluginId);

  if (needsScan(folder) || isError(folder)) {
    try {
      const plugin = await loadPlugin(pluginId);
      if (plugin.scanFolder) {
        const context = createPluginContext(pluginId);
        await plugin.scanFolder(context, folder.id, { recursive: true, force: true });
      }
    } catch (err) {
      console.warn('[FolderList] failed to scan pending folder', err);
    }
  }

  router.push({
    name: 'folder',
    params: {
      pluginId: folder.pluginId,
      path: urlPathToSegments(folder.urlPath),
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

function playFolder(folder: FolderRef): void {
  if (!isScanned(folder)) {
    toastService.info('Папка ещё не отсканирована');
    return;
  }

  // Обход вглубь: треки из папки + всех подпапок.
  const subtreeTracks = library.subtreeTracksMap.get(folder.id) ?? [];
  if (subtreeTracks.length === 0) {
    toastService.info('В этой папке нет треков для воспроизведения');
    return;
  }
  player.playAll(subtreeTracks);
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
