<!-- src/views/playlist/PlaylistToolbar.vue -->
<script setup lang="ts">
import SearchInput from '@/components/ui/SearchInput.vue'
import MetadataMenu from '@/components/library/MetadataMenu.vue'
import IconButton from '@/components/ui/IconButton.vue'

defineProps<{
  query: string
  isFavorites: boolean
  metadataLoading: boolean
  metadataProgress: { done: number; total: number }
  metadataStats: { found: number; checked: number; total: number }
  metadataHasUnchecked: boolean
  metadataIssuesCount: number
}>()

const emit = defineEmits<{
  (e: 'update:query', value: string): void
  (e: 'metadata-search'): void
  (e: 'metadata-cancel'): void
  (e: 'metadata-reset'): void
  (e: 'open-issues'): void
  (e: 'delete'): void
}>()
</script>

<template>
  <div class="flex shrink-0 flex-col gap-2 px-4 py-2">
    <div class="mx-auto flex w-full max-w-3xl items-center justify-between gap-3">
      <div class="flex items-center gap-2">
        <SearchInput :model-value="query" @update:model-value="(v: string) => emit('update:query', v)" />
      </div>

      <div class="flex shrink-0 items-center gap-2">
        <MetadataMenu :is-loading="metadataLoading" :progress="metadataProgress" :stats="metadataStats"
          :has-unchecked="metadataHasUnchecked" :issues-count="metadataIssuesCount" @search="emit('metadata-search')"
          @cancel="emit('metadata-cancel')" @reset="emit('metadata-reset')" @open-issues="emit('open-issues')" />

        <IconButton v-if="!isFavorites" icon="trash" variant="danger" label="Удалить плейлист"
          @click="emit('delete')" />
      </div>
    </div>

    <div v-if="$slots.filters" class="mx-auto w-full max-w-3xl">
      <slot name="filters" />
    </div>
  </div>
</template>
