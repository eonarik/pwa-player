<!-- src/plugins/yandexSelf/logii/LogiiAuthorsColumn.vue -->

<script setup lang="ts">
import Icon from '@/components/ui/Icon.vue';
import Spinner from '@/components/ui/Spinner.vue';
import type { LogiiAuthorItem } from './useLogiiData';

defineProps<{
  authors: LogiiAuthorItem[];
  currentAuthorName: string | null;
  isLoading: boolean;
  isCollapsed: boolean;
}>();

const emit = defineEmits<{
  (e: 'select', author: LogiiAuthorItem): void;
  (e: 'toggle-collapsed'): void;
}>();

function initialOf(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  return trimmed[0]!.toUpperCase();
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
          class="flex w-full items-center rounded-btn transition"
          :class="[
            currentAuthorName === a.folderName ? 'bg-active/10 text-active' : 'text-fg hover:bg-hover-bg',
            isCollapsed ? 'justify-center px-1 py-2' : 'gap-2 px-2 py-1.5',
          ]"
          :title="isCollapsed ? a.folderName : undefined"
          @click="emit('select', a)"
        >
          <span
            class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium"
            :class="currentAuthorName === a.folderName ? 'bg-active text-bg' : 'bg-card-bg text-fg-muted'"
          >
            {{ initialOf(a.folderName) }}
          </span>

          <span v-if="!isCollapsed" class="truncate text-sm">{{ a.folderName }}</span>
        </button>

        <p v-if="authors.length === 0" class="px-3 py-2 text-center text-xs text-fg-muted">—</p>
      </template>
    </div>
  </aside>
</template>
