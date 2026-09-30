<!-- src/components/library/MetadataMenu.vue -->
<script setup lang="ts">
import { useMenu } from '@/composables/useMenu'

defineProps<{
  isLoading: boolean
  progress: { done: number; total: number }
  stats: { found: number; checked: number; total: number }
  hasUnchecked: boolean
  issuesCount: number
}>()

const emit = defineEmits<{
  (e: 'search'): void
  (e: 'cancel'): void
  (e: 'reset'): void
  (e: 'open-issues'): void
}>()

const { isOpen, rootRef, toggle } = useMenu()
</script>

<template>
  <div ref="rootRef" class="relative">
    <button type="button"
      class="flex items-center gap-1 rounded-btn bg-card-bg px-3 py-1.5 text-xs text-fg transition hover:bg-hover-bg"
      @click.stop="toggle">
      <span v-if="isLoading">Поиск данных… {{ progress.done }}/{{ progress.total }}</span>
      <span v-else :class="issuesCount > 0 ? 'text-amber-400' : ''">Метаданные</span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-3 w-3 transition"
        :class="isOpen ? 'rotate-180' : ''">
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>

    <div v-if="isOpen" class="absolute right-0 top-full z-20 mt-1 w-64 overflow-hidden bg-bg-elevated shadow-lg">
      <!-- Идёт поиск -->
      <template v-if="isLoading">
        <div class="flex items-center gap-2 px-4 py-2.5 text-xs text-fg-muted">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-3.5 w-3.5 animate-spin">
            <path d="M12 3a9 9 0 019 9" />
          </svg>
          Поиск данных… {{ progress.done }}/{{ progress.total }}
        </div>
        <button type="button"
          class="block w-full px-4 py-1.5 text-left text-xs text-fg-muted transition hover:bg-hover-bg hover:text-fg"
          @click="emit('cancel')">
          Отмена
        </button>
      </template>

      <!-- Ничего не искали -->
      <template v-else-if="stats.found === 0">
        <button type="button"
          class="block w-full px-4 py-2.5 text-left text-sm text-fg transition hover:bg-hover-bg disabled:opacity-50"
          :disabled="!hasUnchecked" @click="emit('search')">
          Найти метаданные
          <span class="block text-[10px] text-fg-muted">Через iTunes и Deezer</span>
        </button>
      </template>

      <!-- Нашли хоть что-то -->
      <template v-else>
        <div class="px-4 py-2.5 text-xs text-fg-muted">
          Найдено данных: {{ stats.found }}/{{ stats.total }}
        </div>

        <button v-if="hasUnchecked" type="button"
          class="block w-full px-4 py-2.5 text-left text-sm text-fg transition hover:bg-hover-bg"
          @click="emit('search')">
          Найти ещё
        </button>

        <!-- Проблемные треки — всегда, если есть -->
        <button v-if="issuesCount > 0" type="button"
          class="flex w-full items-center gap-2 border-t border-hover-bg px-4 py-2.5 text-left text-sm text-amber-400 transition hover:bg-hover-bg"
          @click="emit('open-issues')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
            stroke-linejoin="round" class="h-4 w-4 shrink-0">
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span>Поправить треки ({{ issuesCount }})</span>
        </button>

        <button type="button"
          class="block w-full px-4 py-1.5 text-left text-xs text-fg-muted transition hover:bg-hover-bg hover:text-fg"
          @click="emit('reset')">
          Очистить
        </button>
      </template>
    </div>
  </div>
</template>
