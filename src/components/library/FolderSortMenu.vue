<!-- src/components/library/FolderSortMenu.vue -->
<script setup lang="ts">
import { sortService } from '@/services/sort/SortService'
</script>

<template>
  <button type="button"
    class="h-8 w-8 flex items-center justify-center rounded-btn bg-card-bg px-2 py-1.5 text-xs text-fg transition hover:bg-hover-bg"
    :aria-label="sortService.dirLabel" :title="sortService.dirLabel" @click="sortService.toggleDir()">
    <svg v-if="sortService.dir.value === 'asc'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
      class="h-3.5 w-3.5">
      <path d="M12 5v14M19 12l-7 7-7-7" />
    </svg>
    <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-3.5 w-3.5">
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  </button>
</template>
