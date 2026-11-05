<!-- src/components/library/FolderListItem.vue -->

<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useLibraryStore } from '@/stores/library';
import { usePlayerStore } from '@/stores/player';
import { isScanning, isPending, isError, isScanned, getErrorMessage, getProgress } from '@/utils/folderStatus';
import { pluralize } from '@/utils/pluralize';
import ListRow from '@/components/ui/ListRow.vue';
import Icon from '@/components/ui/Icon.vue';
import Spinner from '@/components/ui/Spinner.vue';
import type { FolderRef } from '@/types/folder';
import type { IconName } from '@/components/icons';

const props = defineProps<{
  folder: FolderRef;
}>();

const emit = defineEmits<{
  (e: 'open', folder: FolderRef): void;
  (e: 'play', folder: FolderRef, event: Event): void;
  (e: 'retry', folder: FolderRef): void;
}>();

const library = useLibraryStore();
const player = usePlayerStore();
const { folders, folderStats } = storeToRefs(library);
const { currentTrack } = storeToRefs(player);

/** Префикс подплагина (например, `logii.`). */
const SUBPLUGIN_PREFIX = 'logii.';

const isSubplugin = computed(() => props.folder.name.startsWith(SUBPLUGIN_PREFIX));

const displayName = computed(() => {
  if (isSubplugin.value) {
    return props.folder.name.slice(SUBPLUGIN_PREFIX.length);
  }
  return props.folder.name;
});

const leadingIcon = computed<IconName>(() => (isSubplugin.value ? 'radio' : 'folder'));

const isActive = computed(() => {
  const track = currentTrack.value;
  if (!track) return false;

  for (const source of track.sources) {
    if (source.kind === 'local' || source.kind === 'cloud') {
      let current: FolderRef | undefined = folders.value[source.folderId];
      while (current) {
        if (current.id === props.folder.id) return true;
        current = current.parentId ? folders.value[current.parentId] : undefined;
      }
    }
  }
  return false;
});

const status = computed(() => props.folder.scanState);
const scanning = computed(() => isScanning(props.folder));
const pending = computed(() => isPending(props.folder) || status.value === null);
const error = computed(() => isError(props.folder));

const errorMessage = computed(() => (error.value ? getErrorMessage(props.folder) : null));
const progress = computed(() => (scanning.value ? getProgress(props.folder) : null));

const stats = computed(() => folderStats.value.get(props.folder.id) || { folders: 0, tracks: 0 });

const canPlay = computed(() => isScanned(props.folder) && stats.value.tracks > 0);

const displayLabel = computed(() => {
  if (scanning.value) {
    const p = progress.value;
    if (p && p.total > 0) return `Синхронизировано ${p.done} из ${p.total}`;
    return 'Синхронизация...';
  }
  if (error.value) return 'Ошибка синхронизации';
  if (pending.value) return 'Ожидает синхронизации';

  const parts: string[] = [];
  if (stats.value.folders > 0) parts.push(pluralize(stats.value.folders, ['папка', 'папки', 'папок']));
  if (stats.value.tracks > 0) parts.push(pluralize(stats.value.tracks, ['трек', 'трека', 'треков']));
  return parts.length > 0 ? parts.join(' · ') : 'пусто';
});

const labelClass = computed(() => {
  if (error.value) return 'text-red-400';
  if (scanning.value || pending.value) return 'text-amber-400';
  return 'text-fg-muted';
});

const labelTooltip = computed(() => {
  if (error.value && errorMessage.value) return errorMessage.value;
  return undefined;
});

function onPlayClick(e: Event): void {
  if (!canPlay.value) return;
  emit('play', props.folder, e);
}

function onRowClick(): void {
  emit('open', props.folder);
}
</script>

<template>
  <ListRow @click="onRowClick" :active="isActive" :data-testid="`folder-row-${folder.id}`">
    <template #leading>
      <div class="flex shrink-0 items-center gap-2">
        <div
          class="flex h-11 w-11 shrink-0 items-center justify-center rounded-btn transition"
          :class="[
            canPlay
              ? 'bg-card-bg text-fg-muted hover:bg-active/15 hover:text-active cursor-pointer'
              : error
                ? 'bg-red-500/10 text-red-400 cursor-pointer'
                : 'bg-card-bg text-fg-disabled cursor-not-allowed',
          ]"
          :aria-label="canPlay ? `Играть папку ${displayName}` : error ? 'Повторить скан' : 'Недоступно'"
          v-tooltip="
            scanning
              ? 'Синхронизация...'
              : canPlay
                ? 'Играть всё'
                : error
                  ? 'Обновить'
                  : pending
                    ? 'Ожидает синхронизации'
                    : 'Нет доступных треков'
          "
          @click.stop="error ? emit('retry', folder) : onPlayClick($event)"
        >
          <Spinner v-if="scanning" size="sm" />
          <Icon v-else-if="error" name="refresh" w="w-5" h="w-5" />
          <Icon v-else name="play" w="w-5" h="w-5" class="translate-x-[1px]" />
        </div>

        <div
          class="flex h-11 w-11 shrink-0 items-center justify-center rounded-btn"
          :class="error ? 'bg-red-500/10 text-red-400' : 'bg-card-bg text-fg-muted'"
        >
          <Icon :name="leadingIcon" w="w-5" h="w-5" />
        </div>
      </div>
    </template>

    <template #title>
      <p class="truncate text-sm font-medium" :class="isActive ? 'text-active' : ''">{{ displayName }}</p>
    </template>

    <template #subtitle>
      <p class="truncate text-xs" :class="labelClass" :title="labelTooltip">{{ displayLabel }}</p>
    </template>

    <template #trailing>
      <div class="shrink-0 text-fg-subtle">
        <Icon name="chevron-right" w="w-4" h="w-4" />
      </div>
    </template>
  </ListRow>
</template>
