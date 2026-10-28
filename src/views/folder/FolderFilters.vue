<!-- src/views/folder/FolderFilters.vue -->
<script setup lang="ts">
import SearchInput from '@/components/ui/SearchInput.vue'
import FolderSortMenu from '@/components/library/FolderSortMenu.vue'
import FolderSyncMenu from '@/components/library/FolderSyncMenu.vue'
import FolderSettingsMenu from '@/components/library/FolderSettingsMenu.vue'
import MetadataMenu from '@/components/library/MetadataMenu.vue'
import AlternatesButton from '@/components/library/AlternatesButton.vue' // <-- ДОБАВЛЕНО
import Divider from '@/components/ui/Divider.vue'
import type { Track } from '@/types/track'

defineProps<{
  query: string
  tracks: Track[] // <-- ДОБАВЛЕНО
  metadataLoading: boolean
  metadataProgress: { done: number; total: number }
  metadataStats: { found: number; checked: number; total: number }
  metadataHasUnchecked: boolean
  metadataIssuesCount: number
  canRefresh: boolean
  canRefreshFromDevice: boolean
  isRefreshing: boolean
  isRefreshingFromDevice: boolean
}>()

const emit = defineEmits<{
  (e: 'update:query', value: string): void
  (e: 'metadata-search'): void
  (e: 'metadata-cancel'): void
  (e: 'metadata-reset'): void
  (e: 'open-issues'): void
  (e: 'refresh-cloud'): void
  (e: 'refresh-device'): void
}>()

function onQueryUpdate(value: string): void {
  emit('update:query', value)
}
</script>

<template>
  <div class="flex shrink-0 items-center justify-between gap-3 px-4 py-2">
    <div class="mx-auto flex w-full max-w-3xl items-center justify-between gap-3">
      <div class="flex items-center gap-1">
        <SearchInput :model-value="query" @update:model-value="onQueryUpdate" />
        <FolderSortMenu />
      </div>

      <div class="flex shrink-0 items-center gap-2">
        <!-- <-- ДОБАВЛЕНО -->
        <AlternatesButton :tracks="tracks" />

        <MetadataMenu :is-loading="metadataLoading" :progress="metadataProgress" :stats="metadataStats"
          :has-unchecked="metadataHasUnchecked" :issues-count="metadataIssuesCount" @search="emit('metadata-search')"
          @cancel="emit('metadata-cancel')" @reset="emit('metadata-reset')" @open-issues="emit('open-issues')" />

        <template v-if="canRefresh || canRefreshFromDevice">
          <Divider :vertical="true" with-margin />

          <FolderSyncMenu :can-refresh="canRefresh" :can-refresh-from-device="canRefreshFromDevice"
            :is-refreshing="isRefreshing" :is-refreshing-from-device="isRefreshingFromDevice"
            @refresh-cloud="emit('refresh-cloud')" @refresh-device="emit('refresh-device')" />
        </template>

        <FolderSettingsMenu />
      </div>
    </div>
  </div>
</template>
