<!-- src/plugins/yandexSelf/logii/LogiiFoldersColumn.vue -->

<script setup lang="ts">
import { computed } from 'vue';
import { sortService } from '@/services/sort/SortService';
import Icon from '@/components/ui/Icon.vue';
import IconButton from '@/components/ui/IconButton.vue';
import type { LogiiTrackItem } from './useLogiiData';

const props = defineProps<{
  folders: LogiiTrackItem[];
  currentFolderName: string | null;
  hasAuthorIntro: boolean;
  authorIntroFileName: string | null;
  currentAuthorName: string | null;
}>();

const emit = defineEmits<{
  (e: 'select', folder: LogiiTrackItem): void;
  (e: 'select-intro'): void;
}>();

const sortedFolders = computed(() => {
  const items = props.folders.map((f) => ({ name: f.folderName, folder: f }));
  return sortService.sortByName(items).map((x) => x.folder);
});

const sortIcon = computed(() => (sortService.dir.value === 'asc' ? 'arrow-down' : 'arrow-up'));
const sortLabel = computed(() => sortService.dirLabel);

const isIntroActive = computed(() => Boolean(props.currentAuthorName) && props.currentFolderName === null);
</script>

<template>
  <aside class="hidden w-48 shrink-0 overflow-y-auto border-r border-hover-bg bg-bg-elevated/20 md:block">
    <div class="p-2">
      <!-- Intro: показываем исходное имя файла -->
      <button
        v-if="hasAuthorIntro && authorIntroFileName"
        type="button"
        class="mb-1 flex w-full items-center gap-2 rounded-btn px-2 py-1.5 text-left text-sm transition"
        :class="isIntroActive ? 'bg-active/10 text-active' : 'text-fg hover:bg-hover-bg'"
        :title="authorIntroFileName"
        @click="emit('select-intro')"
      >
        <Icon name="file" w="w-4" h="h-4" class="shrink-0 text-fg-muted" />
        <span class="truncate">{{ authorIntroFileName }}</span>
      </button>

      <div v-if="hasAuthorIntro" class="mb-1 border-t border-hover-bg" />

      <!-- Заголовок + сортировка -->
      <div class="flex items-center justify-between pl-2 py-1">
        <p class="text-[10px] font-medium uppercase tracking-wider text-fg-subtle">Папки</p>
        <IconButton :icon="sortIcon" variant="ghost" size="sm" :label="sortLabel" @click="sortService.toggleDir()" />
      </div>

      <button
        v-for="f in sortedFolders"
        :key="f.urlPath"
        type="button"
        class="flex w-full items-center gap-2 rounded-btn px-2 py-1.5 text-left text-sm transition"
        :class="currentFolderName === f.folderName ? 'bg-active/10 text-active' : 'text-fg hover:bg-hover-bg'"
        @click="emit('select', f)"
      >
        <span class="truncate">{{ f.folderName }}</span>
      </button>

      <p v-if="sortedFolders.length === 0" class="px-3 py-2 text-center text-xs text-fg-muted">—</p>
    </div>
  </aside>
</template>
