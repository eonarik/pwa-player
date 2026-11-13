<!-- src/components/library/FolderActionsMenu.vue -->

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import DropdownMenu from '@/components/molecules/DropdownMenu.vue';
import Icon from '@/components/atoms/Icon.vue';
import { getExtensionFolderActions } from '@/plugins/extensions';
import { toastService } from '@/services/ui/ToastService';
import { urlPathToSegments } from '@/utils/urlPath';
import PlaylistSubmenu from '@/components/library/PlaylistSubmenu.vue';
import { useBatchDownload } from '@/composables/useBatchDownload';
import type { FolderRef } from '@/types/folder';
import type { Track } from '@/types/track';
import type { PluginFolderAction } from '@/plugins/types';
import Divider from '../atoms/Divider.vue';
import IconButton from '../atoms/IconButton.vue';
import { logger } from '@/utils/logger';

const props = defineProps<{
  folder: FolderRef | null;
  /** Все треки в поддереве (для «Скачать всё» — рекурсивно). */
  subtreeTracks: Track[];
  /** Треки только текущей папки (для «Добавить в плейлист» — нерекурсивно). */
  currentTracks: Track[];
}>();

const router = useRouter();

const runningActionId = ref<string | null>(null);

const visibleFolderActions = computed<PluginFolderAction[]>(() => {
  if (!props.folder) return [];
  return getExtensionFolderActions().filter((a) => {
    try {
      return a.shouldShow(props.folder!);
    } catch (err) {
      logger.warn('[FolderActionsMenu] shouldShow failed', err);
      return false;
    }
  });
});

const hasPlaylistAction = computed(() => props.currentTracks.length > 0);

const {
  isDownloading,
  progress,
  hasDownloadable,
  pendingCount,
  download,
  cancel: cancelDownload,
} = useBatchDownload(computed(() => props.subtreeTracks));

const downloadLabel = computed(() => {
  if (isDownloading.value) {
    const p = progress.value;
    return p ? `${p.done}/${p.total} · Отменить` : 'Отмена';
  }
  if (pendingCount.value === 0) return 'Скачано';
  return 'Скачать все';
});

async function runFolderAction(action: PluginFolderAction): Promise<void> {
  if (!props.folder || runningActionId.value) return;
  runningActionId.value = action.id;

  try {
    const result = await action.run({
      folder: props.folder,
      showToast: (msg, type) => toastService.show(msg, type ?? 'info'),
    });
    if (result.kind === 'navigate') {
      router.push({
        name: 'folder',
        params: { pluginId: result.pluginId, path: urlPathToSegments(result.urlPath) },
      });
    }
  } catch (err) {
    logger.error(`[FolderActionsMenu] action "${action.id}" failed`, err);
    toastService.error(err instanceof Error ? err.message : 'Не удалось выполнить действие');
  } finally {
    runningActionId.value = null;
  }
}

function onDownloadClick(): void {
  if (isDownloading.value) {
    cancelDownload();
    return;
  }
  if (pendingCount.value === 0) return;
  void download();
}
</script>

<template>
  <DropdownMenu :width="240" align="right">
    <template #trigger="{ toggle, setTriggerRef }">
      <div :ref="setTriggerRef">
        <IconButton icon="dots" label="Действия" data-testid="folder-actions-trigger" @click="toggle" />
      </div>
    </template>

    <template #default="{ close }">
      <button
        v-for="action in visibleFolderActions"
        :key="action.id"
        type="button"
        class="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-fg leading-tight transition hover:bg-hover-bg disabled:opacity-50 disabled:cursor-not-allowed"
        :title="action.tooltip ?? action.label"
        :disabled="runningActionId !== null"
        :data-testid="`folder-action-${action.id}`"
        @click="
          () => {
            close();
            void runFolderAction(action);
          }
        "
      >
        <Icon v-if="action.icon" :name="action.icon" w="w-4" h="h-4" class="shrink-0 text-fg-muted" />
        <span class="flex flex-col gap-1">
          <span class="truncate">{{ action.label }}</span>
          <template v-if="action.tooltip">
            <span class="text-fg-subtle text-xs">{{ action.tooltip }}</span>
          </template>
        </span>
      </button>

      <Divider v-if="visibleFolderActions.length > 0 && (hasPlaylistAction || hasDownloadable)" />

      <div v-if="hasPlaylistAction">
        <PlaylistSubmenu :tracks="currentTracks" in-dropdown test-id-prefix="folder-playlist" @close="close" />
      </div>

      <button
        v-if="hasDownloadable"
        type="button"
        class="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-fg transition hover:bg-hover-bg disabled:opacity-50 disabled:cursor-not-allowed"
        :disabled="pendingCount === 0 && !isDownloading"
        data-testid="folder-action-download-all"
        @click="onDownloadClick"
      >
        <Icon v-if="pendingCount === 0 && !isDownloading" name="check" w="w-4" h="h-4" class="shrink-0 text-fg-muted" />
        <Icon v-else name="download" w="w-4" h="h-4" class="shrink-0 text-fg-muted" />
        <span class="truncate">{{ downloadLabel }}</span>
      </button>
    </template>
  </DropdownMenu>
</template>
