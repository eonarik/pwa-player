<!-- src/components/library/CoverSearchButton.vue -->
<script setup lang="ts">
import { computed, toRef } from 'vue'
import { useCoverSearch } from '@/composables/useCoverSearch'
import type { LibraryTrack } from '@/types/library'

const props = defineProps<{
  tracks: LibraryTrack[]
}>()

const tracksRef = toRef(props, 'tracks')

const { isLoading, progress, stats, hasUnchecked, search, cancel, reset } =
  useCoverSearch(tracksRef)

const showFind = computed(() => !isLoading.value && stats.value.found === 0)
const showProgress = computed(() => isLoading.value)
const showFound = computed(() => !isLoading.value && stats.value.found > 0)

const foundLabel = computed(() => `${stats.value.found}/${stats.value.total}`)

function onFind() {
  void search()
}

function onCancel() {
  cancel()
}

function onReset() {
  void reset()
}
</script>

<template>
  <div class="flex items-center gap-2">
    <!-- Идёт поиск -->
    <template v-if="showProgress">
      <div class="flex items-center gap-2 text-xs text-fg-muted">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-3.5 w-3.5 animate-spin">
          <path d="M12 3a9 9 0 019 9" />
        </svg>
        <span>Поиск обложек… {{ progress.done }}/{{ progress.total }}</span>
      </div>

      <button type="button"
        class="rounded-btn bg-card-bg px-2 py-1 text-xs text-fg-muted transition hover:bg-hover-bg hover:text-fg"
        @click="onCancel">
        Отмена
      </button>
    </template>

    <!-- Найти (если ничего не найдено) -->
    <button v-else-if="showFind" type="button"
      class="rounded-btn bg-card-bg px-3 py-1.5 text-xs text-fg transition hover:bg-hover-bg disabled:opacity-50"
      :disabled="!hasUnchecked" @click="onFind">
      Найти обложки
    </button>

    <!-- Найдено (n > 0) -->
    <template v-else-if="showFound">
      <span class="text-xs text-fg-muted">Найдено обложек: {{ foundLabel }}</span>

      <button v-if="hasUnchecked" type="button"
        class="rounded-btn bg-card-bg px-2 py-1 text-xs text-fg transition hover:bg-hover-bg" @click="onFind">
        Найти ещё
      </button>

      <button type="button"
        class="rounded-btn bg-card-bg px-2 py-1 text-xs text-fg transition hover:bg-red-500/10 hover:text-red-400"
        @click="onReset">
        Очистить
      </button>
    </template>
  </div>
</template>
