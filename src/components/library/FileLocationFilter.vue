<!-- src/components/library/FileLocationFilter.vue -->
<script setup lang="ts">
import type { FilterOption } from '@/types/filter'

defineProps<{
  options: FilterOption[]
}>()

const model = defineModel<string>({ default: 'all' })
</script>

<template>
  <div class="flex items-center gap-2">
    <button type="button" class="rounded-btn px-3 py-1 text-xs transition"
      :class="model === 'all' ? 'bg-card-bg text-fg font-medium' : 'text-fg-muted hover:text-fg hover:bg-hover-bg'"
      @click="model = 'all'">
      Все
    </button>
    <button v-for="opt in options" :key="opt.id" type="button" class="rounded-btn px-3 py-1 text-xs transition"
      :class="model === opt.id ? 'bg-card-bg text-fg font-medium' : 'text-fg-muted hover:text-fg hover:bg-hover-bg'"
      @click="model = opt.id">
      {{ opt.label }}
    </button>
  </div>
</template>
