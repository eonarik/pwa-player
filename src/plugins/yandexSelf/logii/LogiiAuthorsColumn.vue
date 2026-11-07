<!-- src/plugins/yandexSelf/logii/LogiiAuthorsColumn.vue -->

<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { usePlayerStore } from '@/stores/player';
import Icon from '@/components/ui/Icon.vue';
import Spinner from '@/components/ui/Spinner.vue';
import { authorAvatarColor } from './authorColor';
import type { LogiiAuthorItem } from './useLogiiData';
import type { Track } from '@/types/track';

const props = defineProps<{
  authors: LogiiAuthorItem[];
  currentAuthorName: string | null;
  isLoading: boolean;
  isCollapsed: boolean;
  allTracksByAuthor: Map<string, Track[]>;
}>();

const emit = defineEmits<{
  (e: 'select', author: LogiiAuthorItem): void;
  (e: 'toggle-collapsed'): void;
  (e: 'play-author', author: LogiiAuthorItem): void;
}>();

const player = usePlayerStore();
const { currentTrack, isPlaying } = storeToRefs(player);

const currentTrackId = computed(() => currentTrack.value?.id ?? null);

const trackIdsByAuthor = computed<Map<string, Set<string>>>(() => {
  const map = new Map<string, Set<string>>();
  for (const [authorUrlPath, tracks] of props.allTracksByAuthor.entries()) {
    const ids = new Set<string>();
    for (const t of tracks) ids.add(t.id);
    map.set(authorUrlPath, ids);
  }
  return map;
});

function initialOf(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  return trimmed[0]!.toUpperCase();
}

function avatarColor(author: LogiiAuthorItem): string {
  return authorAvatarColor(author.folderName);
}

function isAuthorPlaying(author: LogiiAuthorItem): boolean {
  const ids = trackIdsByAuthor.value.get(author.urlPath);
  if (!ids || !currentTrackId.value) return false;
  return ids.has(currentTrackId.value) && isPlaying.value;
}

function isAuthorCurrent(author: LogiiAuthorItem): boolean {
  const ids = trackIdsByAuthor.value.get(author.urlPath);
  if (!ids || !currentTrackId.value) return false;
  return ids.has(currentTrackId.value);
}

function hasTracks(author: LogiiAuthorItem): boolean {
  const tracks = props.allTracksByAuthor.get(author.urlPath);
  return Boolean(tracks && tracks.length > 0);
}

function onPlayAuthor(author: LogiiAuthorItem, e: MouseEvent): void {
  e.stopPropagation();
  emit('play-author', author);
}
</script>

<template>
  <aside
    class="hidden shrink-0 overflow-y-auto border-r border-hover-bg bg-bg-elevated/40 transition-all duration-200 md:block"
    :class="isCollapsed ? 'w-14' : 'w-44'"
  >
    <div class="p-2">
      <div class="flex items-center justify-between pb-2">
        <p v-if="!isCollapsed" class="text-[10px] font-medium uppercase tracking-wider text-fg-subtle">Авторы</p>
        <button
          type="button"
          class="w-8 h-8 rounded-btn p-0.5 text-fg-subtle transition hover:bg-hover-bg hover:text-fg"
          :aria-label="isCollapsed ? 'Развернуть авторов' : 'Свернуть авторов'"
          @click="emit('toggle-collapsed')"
        >
          <Icon :name="isCollapsed ? 'chevron-right' : 'chevron-left'" w="w-3.5" h="h-3.5" />
        </button>
      </div>

      <div v-if="isLoading" class="flex justify-center py-4">
        <Spinner size="sm" />
      </div>

      <template v-else>
        <button
          v-for="a in authors"
          :key="a.urlPath"
          type="button"
          class="group flex w-full items-center rounded-btn transition"
          :class="[
            currentAuthorName === a.folderName ? 'bg-active/10 text-active' : 'text-fg hover:bg-hover-bg',
            isCollapsed ? 'justify-center px-1 py-2' : 'gap-2 px-2 py-1.5',
          ]"
          :title="isCollapsed ? a.folderName : undefined"
          :data-testid="`author-row-${a.folderName}`"
          @click="emit('select', a)"
        >
          <span class="relative inline-flex shrink-0">
            <span
              class="flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium text-white transition"
              :style="{ backgroundColor: avatarColor(a) }"
            >
              {{ initialOf(a.folderName) }}
            </span>

            <span
              role="button"
              tabindex="0"
              class="absolute inset-0 flex items-center justify-center rounded-full bg-bg/50 transition"
              :class="[
                isAuthorCurrent(a) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
                hasTracks(a) ? 'cursor-pointer' : 'cursor-not-allowed',
              ]"
              :aria-label="isAuthorPlaying(a) ? 'Пауза' : 'Играть все треки автора'"
              :aria-disabled="!hasTracks(a)"
              :data-testid="`author-play-${a.folderName}`"
              @click="onPlayAuthor(a, $event)"
              @keydown.enter.prevent="onPlayAuthor(a, $event as unknown as MouseEvent)"
              @keydown.space.prevent="onPlayAuthor(a, $event as unknown as MouseEvent)"
            >
              <Icon
                :name="isAuthorPlaying(a) ? 'pause' : 'play'"
                w="w-3.5"
                h="h-3.5"
                class="text-white drop-shadow"
                :class="isAuthorPlaying(a) ? '' : 'translate-x-[1px]'"
              />
            </span>
          </span>

          <span v-if="!isCollapsed" class="truncate text-sm">{{ a.folderName }}</span>
        </button>

        <p v-if="authors.length === 0" class="px-3 py-2 text-center text-xs text-fg-muted">—</p>
      </template>
    </div>
  </aside>
</template>
