<!-- src/components/library/FolderListItem.vue -->

<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useLibraryStore } from '@/stores/library';
import { usePlayerStore } from '@/stores/player';
import { folderStatusService } from '@/services/folders/FolderStatusService';
import { pluralize } from '@/utils/pluralize';
import ListRow from '@/components/ui/ListRow.vue';
import Icon from '@/components/ui/Icon.vue';
import Spinner from '@/components/ui/Spinner.vue';
import type { FolderRef } from '@/types/folder';
import type { FolderId } from '@/types/ids';

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
const { folders } = storeToRefs(library);
const { currentTrack } = storeToRefs(player);

function isDescendant(childId: FolderId, parentId: FolderId): boolean {
  let current: FolderRef | undefined = folders.value[childId];

  while (current) {
    if (current.id === parentId) return true;
    current = current.parentId ? folders.value[current.parentId] : undefined;
  }
  return false;
}

const isActive = computed(() => {
  const track = currentTrack.value;
  if (!track) return false;

  for (const source of track.sources) {
    if (source.kind === 'local' || source.kind === 'cloud') {
      if (isDescendant(source.folderId, props.folder.id)) {
        return true;
      }
    }
  }
  return false;
});

const status = computed(() => folderStatusService.getStatus(props.folder.id));
const isScanning = computed(() => status.value === 'scanning');
const isPending = computed(() => status.value === 'pending' || status.value === null);
const isError = computed(() => status.value === 'error');

const canEnter = computed(() => true);
const canPlay = computed(() => status.value === 'scanned' && trackCount.value > 0);

const trackCount = computed(() => {
  let count = 0;
  const seen = new Set<string>();

  const walk = (folderId: FolderId) => {
    if (seen.has(folderId)) return;
    seen.add(folderId);

    const folder = folders.value[folderId];
    if (!folder) return;

    // Используем trackIds из папки
    count += (folder.trackIds || []).length;

    for (const f of Object.values(folders.value)) {
      if (f.parentId === folderId) walk(f.id);
    }
  };
  walk(props.folder.id);
  return count;
});

const folderCount = computed(() => {
  let count = 0;
  const seen = new Set<string>();

  const walk = (folderId: FolderId) => {
    if (seen.has(folderId)) return;
    seen.add(folderId);

    for (const f of Object.values(folders.value)) {
      if (f.parentId === folderId) {
        count++;
        walk(f.id);
      }
    }
  };
  walk(props.folder.id);
  return count;
});

const displayLabel = computed(() => {
  if (isScanning.value) return 'Синхронизация...';
  if (isError.value) return 'Ошибка синхронизации';
  if (isPending.value) return 'Ожидает сканирования';

  const parts: string[] = [];
  if (folderCount.value > 0) parts.push(pluralize(folderCount.value, ['папка', 'папки', 'папок']));
  if (trackCount.value > 0) parts.push(pluralize(trackCount.value, ['трек', 'трека', 'треков']));
  return parts.length > 0 ? parts.join(' · ') : 'пусто';
});

const labelClass = computed(() => {
  if (isError.value) return 'text-red-400';
  if (isScanning.value || isPending.value) return 'text-amber-400';
  return 'text-fg-muted';
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
              : isError
                ? 'bg-red-500/10 text-red-400 cursor-pointer'
                : 'bg-card-bg text-fg-disabled cursor-not-allowed',
          ]"
          :aria-label="canPlay ? `Играть папку ${folder.name}` : isError ? 'Повторить скан' : 'Недоступно'"
          v-tooltip="
            isScanning
              ? 'Синхронизация...'
              : canPlay
                ? 'Играть всё'
                : isError
                  ? 'Обновить'
                  : isPending
                    ? 'Ожидает сканирования'
                    : 'Нет доступных треков'
          "
          @click.stop="isError ? emit('retry', folder) : onPlayClick($event)"
        >
          <Spinner v-if="isScanning" size="sm" />
          <Icon v-else-if="isError" name="refresh" w="w-5" h="w-5" />
          <Icon v-else name="play" w="w-5" h="w-5" class="translate-x-[1px]" />
        </div>

        <div
          class="flex h-11 w-11 shrink-0 items-center justify-center rounded-btn"
          :class="isError ? 'bg-red-500/10 text-red-400' : 'bg-card-bg text-fg-muted'"
        >
          <Icon name="folder" w="w-5" h="w-5" />
        </div>
      </div>
    </template>

    <template #title>
      <p class="truncate text-sm font-medium" :class="isActive ? 'text-active' : ''">{{ folder.name }}</p>
    </template>

    <template #subtitle>
      <p class="truncate text-xs" :class="labelClass">{{ displayLabel }}</p>
    </template>

    <template #trailing>
      <div class="shrink-0" :class="canEnter ? 'text-fg-subtle' : 'text-fg-disabled'">
        <Icon name="chevron-right" w="w-4" h="w-4" />
      </div>
    </template>
  </ListRow>
</template>
