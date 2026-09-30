<!-- src/components/library/FolderCoversMenu.vue -->
<script setup lang="ts">
import { useMenu } from '@/composables/useMenu'
import { useCoverSearch } from '@/composables/useCoverSearch'
import type { LibraryTrack } from '@/types/library'
import { toRef } from 'vue'

const props = defineProps<{
  tracks: LibraryTrack[]
}>()

const tracksRef = toRef(props, 'tracks')
// ↑ хак, но работает: tracks приходит как реактивный массив из computed
// Правильнее — toRef, но он не работает с props напрямую

const { isOpen, rootRef, toggle, close } = useMenu()

const {
  isLoading,
  progress,
  stats,
  hasUnchecked,
  search,
  cancel,
  reset,
} = useCoverSearch(tracksRef)

function onFind() {
  void search()
}

function onCancel() {
  cancel()
}

async function onReset() {
  await reset()
  close()
}
</script>

<template>
  <div ref="rootRef" class="relative">
    <button type="button"
      class="flex items-center gap-1 rounded-btn bg-card-bg px-3 py-1.5 text-xs text-fg transition hover:bg-hover-bg"
      @click.stop="toggle">
      <span v-if="isLoading">
        Поиск обложек… {{ progress.done }}/{{ progress.total }}
      </span>
      <span v-else>Обложки</span>
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
          Поиск обложек… {{ progress.done }}/{{ progress.total }}
        </div>

        <button type="button"
          class="block w-full px-4 py-1.5 text-left text-xs text-fg-muted transition hover:bg-hover-bg hover:text-fg"
          @click="onCancel">
          Отмена
        </button>
      </template>

      <!-- Ничего не искали -->
      <template v-else-if="stats.found === 0">
        <button type="button"
          class="block w-full px-4 py-2.5 text-left text-sm text-fg transition hover:bg-hover-bg disabled:opacity-50"
          :disabled="!hasUnchecked" @click="onFind">
          Найти обложки
          <span class="block text-[10px] text-fg-muted">Через iTunes и Deezer</span>
        </button>
      </template>

      <!-- Нашли хоть что-то -->
      <template v-else>
        <div class="px-4 py-2.5 text-xs text-fg-muted">
          Найдено обложек: {{ stats.found }}/{{ stats.total }}
        </div>

        <button v-if="hasUnchecked" type="button"
          class="block w-full px-4 py-2.5 text-left text-sm text-fg transition hover:bg-hover-bg" @click="onFind">
          Найти ещё
        </button>

        <button type="button"
          class="block w-full px-4 py-1.5 text-left text-xs text-fg-muted transition hover:bg-hover-bg hover:text-fg"
          @click="onReset">
          Очистить
        </button>
      </template>
    </div>
  </div>
</template>
