<!-- src/views/folder/FolderHeader.vue -->

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import FolderBreadcrumbs from '@/components/library/FolderBreadcrumbs.vue';
import BatchDownloadButton from '@/components/library/BatchDownloadButton.vue';
import BatchAddToPlaylistButton from '@/components/library/BatchAddToPlaylistButton.vue';
import Icon from '@/components/ui/Icon.vue';
import Spinner from '@/components/ui/Spinner.vue';
import { getExtensionFolderActions } from '@/plugins/extensions';
import { toastService } from '@/services/ui/ToastService';
import { pluralize } from '@/utils/pluralize';
import { urlPathToSegments } from '@/utils/urlPath';
import type { FolderRef } from '@/types/folder';
import type { Track } from '@/types/track';
import type { PluginFolderAction } from '@/plugins/types';

const props = defineProps<{
  currentFolder: FolderRef | null;
  subfoldersCount: number;
  tracksCount: number;
  filesCount: number;
  subtreeTracks: Track[];
  isScanning: boolean;
}>();

const router = useRouter();

const runningActionId = ref<string | null>(null);

const visibleActions = computed<PluginFolderAction[]>(() => {
  if (!props.currentFolder) return [];
  return getExtensionFolderActions().filter((a) => {
    try {
      return a.shouldShow(props.currentFolder!);
    } catch (err) {
      console.warn('[FolderHeader] shouldShow failed', err);
      return false;
    }
  });
});

async function runAction(action: PluginFolderAction): Promise<void> {
  if (!props.currentFolder || runningActionId.value) return;
  runningActionId.value = action.id;

  try {
    const result = await action.run({
      folder: props.currentFolder,
      showToast: (msg, type) => toastService.show(msg, type ?? 'info'),
    });
    if (result.kind === 'navigate') {
      router.push({
        name: 'folder',
        params: { pluginId: result.pluginId, path: urlPathToSegments(result.urlPath) },
      });
    }
  } catch (err) {
    console.error(`[FolderHeader] action "${action.id}" failed`, err);
    toastService.error(err instanceof Error ? err.message : 'Не удалось выполнить действие');
  } finally {
    runningActionId.value = null;
  }
}
</script>

<template>
  <div class="flex shrink-0 items-center justify-between gap-3 px-4 pt-3">
    <div class="mx-auto flex w-full max-w-3xl items-center justify-between gap-3">
      <FolderBreadcrumbs />

      <div class="flex items-center gap-2">
        <span v-if="currentFolder && !isScanning" class="shrink-0 text-xs text-fg-muted">
          <template v-if="subfoldersCount > 0">{{ pluralize(subfoldersCount, ['папка', 'папки', 'папок']) }}</template>
          <template v-if="subfoldersCount > 0 && tracksCount > 0"> · </template>
          <template v-if="tracksCount > 0">{{ pluralize(tracksCount, ['трек', 'трека', 'треков']) }}</template>
          <template v-if="filesCount > 0 && (subfoldersCount > 0 || tracksCount > 0)"> · </template>
          <template v-if="filesCount > 0">{{ pluralize(filesCount, ['файл', 'файла', 'файлов']) }}</template>
          <template v-if="subfoldersCount === 0 && tracksCount === 0 && filesCount === 0">пусто</template>
        </span>
        <span v-else-if="isScanning" class="shrink-0 text-xs text-fg-muted">Сканирование…</span>

        <button
          v-for="action in visibleActions"
          :key="action.id"
          type="button"
          class="flex items-center gap-1 rounded-btn bg-card-bg px-2 py-1 text-xs text-fg transition hover:bg-hover-bg disabled:opacity-50 disabled:cursor-not-allowed"
          :title="action.tooltip ?? action.label"
          :disabled="runningActionId !== null"
          :data-testid="`folder-action-${action.id}`"
          @click="runAction(action)"
        >
          <Spinner v-if="runningActionId === action.id" size="sm" />
          <Icon v-else-if="action.icon" :name="action.icon" w="w-3.5" h="h-3.5" />
          <span class="hidden sm:inline">{{ action.label }}</span>
        </button>

        <BatchAddToPlaylistButton :tracks="subtreeTracks" />
        <BatchDownloadButton :tracks="subtreeTracks" />
      </div>
    </div>
  </div>
</template>
