<!-- src/components/library/MetadataMenu.vue -->

<script setup lang="ts">
import DropdownMenu from '@/components/ui/DropdownMenu.vue';
import Icon from '@/components/ui/Icon.vue';

defineProps<{
  isLoading: boolean;
  progress: { done: number; total: number };
  stats: { found: number; checked: number; total: number };
  hasUnchecked: boolean;
  issuesCount: number;
}>();

const emit = defineEmits<{
  (e: 'search'): void;
  (e: 'cancel'): void;
  (e: 'reset'): void;
  (e: 'open-issues'): void;
}>();

const onOpenIssues = (close: () => void) => {
  close();
  emit('open-issues');
};
</script>

<template>
  <DropdownMenu :width="256">
    <template #trigger="{ isOpen, toggle, setTriggerRef }">
      <button
        :ref="setTriggerRef"
        type="button"
        class="flex items-center gap-1 rounded-btn bg-card-bg px-3 py-1.5 text-xs text-fg transition hover:bg-hover-bg"
        @click.stop="toggle"
      >
        <span v-if="isLoading">Поиск данных… {{ progress.done }}/{{ progress.total }}</span>
        <span v-else :class="issuesCount > 0 ? 'text-amber-400' : ''">Метаданные</span>
        <Icon name="chevron-down" w="w-3" h="h-3" class="transition" :class="isOpen ? 'rotate-180' : ''" />
      </button>
    </template>

    <template #default="{ close }">
      <template v-if="isLoading">
        <div class="flex items-center gap-2 px-4 py-2.5 text-xs text-fg-muted">
          <Icon name="spinner" w="w-3.5" h="h-3.5" class="animate-spin" />
          Поиск данных… {{ progress.done }}/{{ progress.total }}
        </div>
        <button
          type="button"
          class="block w-full px-4 py-1.5 text-left text-xs text-fg-muted transition hover:bg-hover-bg hover:text-fg"
          @click="emit('cancel')"
        >
          Отмена
        </button>
      </template>

      <template v-else>
        <button
          type="button"
          class="block w-full px-4 py-2.5 text-left text-sm text-fg transition hover:bg-hover-bg disabled:opacity-50"
          :disabled="!hasUnchecked"
          @click="emit('search')"
        >
          {{ stats.found > 0 ? 'Найти ещё' : 'Найти метаданные' }}
          <span class="block text-[10px] text-fg-muted">Через iTunes и Deezer</span>
        </button>

        <div v-if="stats.found > 0" class="px-4 py-2.5 text-xs text-fg-muted border-t border-hover-bg">
          Найдено данных: {{ stats.found }}/{{ stats.total }}
        </div>

        <button
          v-if="stats.checked > 0"
          type="button"
          class="block w-full px-4 py-1.5 text-left text-xs text-fg-muted transition hover:bg-hover-bg hover:text-fg border-t border-hover-bg"
          @click="emit('reset')"
        >
          Очистить кэш
        </button>
      </template>

      <button
        v-if="issuesCount > 0"
        type="button"
        class="flex w-full items-center gap-2 border-t border-hover-bg px-4 py-2.5 text-left text-sm text-amber-400 transition hover:bg-hover-bg"
        @click="onOpenIssues(close)"
      >
        <Icon name="alert-triangle" w="w-4" h="h-4" />
        <span>Поправить треки ({{ issuesCount }})</span>
      </button>
    </template>
  </DropdownMenu>
</template>
