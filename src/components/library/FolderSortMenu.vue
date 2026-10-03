<!-- src/components/library/FolderSortMenu.vue -->
<script setup lang="ts">
import { sortService } from '@/services/sort/SortService'
import IconArrowDown from '@/components/icons/IconArrowDown.vue'
import IconArrowUp from '@/components/icons/IconArrowUp.vue'
</script>

<template>
  <button
    type="button"
    class="flex h-8 w-8 items-center justify-center rounded-btn bg-card-bg text-fg transition hover:bg-hover-bg"
    :aria-label="sortService.dirLabel"
    :title="sortService.dirLabel"
    @click="sortService.toggleDir()"
  >
    <IconArrowDown v-if="sortService.dir.value === 'asc'" class="h-3.5 w-3.5" />
    <IconArrowUp v-else class="h-3.5 w-3.5" />
  </button>
</template>
