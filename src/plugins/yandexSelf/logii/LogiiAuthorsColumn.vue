<!-- src/plugins/yandexSelf/logii/LogiiAuthorsColumn.vue -->

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { usePlayerStore } from '@/stores/player';
import Icon from '@/components/atoms/Icon.vue';
import IconButton from '@/components/atoms/IconButton.vue';
import Spinner from '@/components/atoms/Spinner.vue';
import { useYandexSelfWrites } from './useYandexSelfWrites';
import { useAuthorTrackState } from './useAuthorTrackState';
import { useLogiiAuthorsCrud } from './useLogiiAuthorsCrud';
import LogiiAuthorRow from './LogiiAuthorRow.vue';
import type { LogiiAuthorItem } from './useLogiiData';
import type { Track } from '@/types/track';
import type { FolderRef } from '@/types/folder';

const props = defineProps<{
  authors: LogiiAuthorItem[];
  currentAuthorName: string | null;
  isLoading: boolean;
  isCollapsed: boolean;
  allTracksByAuthor: Map<string, Track[]>;
  seasonFolder: FolderRef | null;
  isEditMode: boolean;
}>();

const emit = defineEmits<{
  (e: 'select', author: LogiiAuthorItem): void;
  (e: 'toggle-collapsed'): void;
  (e: 'play-author', author: LogiiAuthorItem): void;
}>();

const player = usePlayerStore();
const { currentTrack, isPlaying } = storeToRefs(player);
const router = useRouter();

const { isWriting, renameFolder, removeResource } = useYandexSelfWrites();

const currentTrackId = computed(() => currentTrack.value?.id ?? null);

// Composable для playback-статуса
const { isAuthorPlaying, isAuthorCurrent, hasTracks } = useAuthorTrackState({
  allTracksByAuthor: computed(() => props.allTracksByAuthor),
  currentTrackId,
  isPlaying,
});

// Composable для CRUD-операций
const { openCreateModal, openRenameModal, onDeleteAuthor } = useLogiiAuthorsCrud({
  seasonFolder: computed(() => props.seasonFolder),
  currentAuthorName: computed(() => props.currentAuthorName),
  isWriting,
  renameFolder,
  removeResource,
  router,
});

function onPlayAuthor(author: LogiiAuthorItem, e: MouseEvent): void {
  e.stopPropagation();
  emit('play-author', author);
}

function isAuthorNavigated(author: LogiiAuthorItem): boolean {
  return props.currentAuthorName === author.folderName;
}
</script>

<template>
  <aside
    class="hidden shrink-0 overflow-y-auto border-r border-hover-bg bg-bg-elevated/40 transition-all duration-200 md:block"
    :class="isCollapsed ? 'w-14' : 'w-44'"
  >
    <div class="p-2">
      <div class="flex items-center justify-between pb-2 gap-1">
        <p v-if="!isCollapsed" class="text-[10px] font-medium uppercase tracking-wider text-fg-subtle">Авторы</p>
        <div class="flex items-center gap-0.5">
          <IconButton
            v-if="!isCollapsed && seasonFolder && isEditMode"
            icon="plus"
            variant="ghost"
            size="sm"
            label="Добавить автора"
            data-testid="author-add"
            :disabled="isWriting"
            :icon-class="isWriting ? 'animate-spin' : ''"
            @click="openCreateModal"
          />
          <button
            type="button"
            class="w-8 h-8 rounded-btn p-0.5 text-fg-subtle transition hover:bg-hover-bg hover:text-fg"
            :aria-label="isCollapsed ? 'Развернуть авторов' : 'Свернуть авторов'"
            @click="emit('toggle-collapsed')"
          >
            <Icon :name="isCollapsed ? 'chevron-right' : 'chevron-left'" w="w-3.5" h="h-3.5" />
          </button>
        </div>
      </div>

      <div v-if="isLoading" class="flex justify-center py-4">
        <Spinner size="sm" />
      </div>

      <template v-else>
        <LogiiAuthorRow
          v-for="a in authors"
          :key="a.urlPath"
          :author="a"
          :is-collapsed="isCollapsed"
          :is-writing="isWriting"
          :has-tracks="hasTracks(a.urlPath)"
          :is-author-current="isAuthorCurrent(a.urlPath)"
          :is-author-playing="isAuthorPlaying(a.urlPath)"
          :is-navigated="isAuthorNavigated(a)"
          :is-edit-mode="isEditMode"
          @select="emit('select', a)"
          @play="onPlayAuthor(a, $event)"
          @rename="openRenameModal(a)"
          @delete="onDeleteAuthor(a)"
        />

        <p v-if="authors.length === 0" class="px-3 py-2 text-center text-xs text-fg-muted">—</p>
      </template>
    </div>
  </aside>
</template>
