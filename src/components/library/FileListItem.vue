<!-- src/components/library/FileListItem.vue -->
<script setup lang="ts">
import ListRow from '@/components/ui/ListRow.vue'
import type { TextFileRef } from '@/types/library'

defineProps<{
  file: TextFileRef
}>()

const emit = defineEmits<{
  (e: 'open'): void
}>()
</script>

<template>
  <ListRow @click="emit('open')">
    <template #leading>
      <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-btn bg-card-bg text-fg-muted">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" class="h-5 w-5">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
          <path d="M9 13h6M9 17h3" />
        </svg>
      </div>
    </template>

    <template #title>
      <p class="truncate text-sm font-medium">{{ file.name }}</p>
    </template>

    <template #subtitle>
      <p class="truncate text-xs text-fg-muted">Текстовый файл</p>
    </template>
  </ListRow>
</template>
