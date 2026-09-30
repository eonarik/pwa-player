<!-- src/components/library/FolderSortMenu.vue -->
<script setup lang="ts">
import { useMenu } from '@/composables/useMenu'
import { FIELD_LABELS, sortService, type SortField } from '@/services/sort/SortService'

const { isOpen, rootRef, toggle, close } = useMenu()

function selectField(field: SortField) {
  sortService.setField(field)
  close()
}
</script>

<template>
  <div ref="rootRef" class="relative flex items-center gap-1">
    <!-- Поле сортировки -->
    <button type="button"
      class="flex items-center gap-1 rounded-btn bg-card-bg px-2 py-1.5 text-xs text-fg transition hover:bg-hover-bg"
      @click.stop="toggle">
      <span>{{ FIELD_LABELS[sortService.field.value] }}</span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-3 w-3 transition"
        :class="isOpen ? 'rotate-180' : ''">
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>

    <div v-if="isOpen" class="absolute left-0 top-full z-20 mt-1 w-40 overflow-hidden bg-bg-elevated shadow-lg">
      <button v-for="(label, field) in FIELD_LABELS" :key="field" type="button"
        class="block w-full px-3 py-2 text-left text-xs text-fg transition hover:bg-hover-bg"
        :class="sortService.field.value === field ? 'bg-active/10 text-active' : ''" @click="selectField(field)">
        {{ label }}
      </button>
    </div>

    <!-- Направление -->
    <button type="button"
      class="flex items-center gap-1 rounded-btn bg-card-bg px-2 py-1.5 text-xs text-fg transition hover:bg-hover-bg"
      :aria-label="sortService.dirLabel" :title="sortService.dirLabel" @click="sortService.toggleDir()">
      <svg v-if="sortService.dir.value === 'asc'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
        class="h-3.5 w-3.5">
        <path d="M12 5v14M19 12l-7 7-7-7" />
      </svg>
      <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-3.5 w-3.5">
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
    </button>
  </div>
</template>
