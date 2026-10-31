<!-- src/views/folder/FolderFilters.vue -->

<script setup lang="ts">
import { computed } from 'vue';
import SearchInput from '@/components/ui/SearchInput.vue';
import FolderSortMenu from '@/components/library/FolderSortMenu.vue';
import FolderSyncMenu from '@/components/library/FolderSyncMenu.vue';
import FolderSettingsMenu from '@/components/library/FolderSettingsMenu.vue';
import MetadataMenu from '@/components/library/MetadataMenu.vue';
import MetadataCandidatesButton from '@/components/library/MetadataCandidatesButton.vue';
import Divider from '@/components/ui/Divider.vue';
import type { Track } from '@/types/track';

const props = defineProps<{
  query: string;
  tracks: Track[];
  metadataLoading: boolean;
  metadataProgress: { done: number; total: number };
  metadataStats: { found: number; checked: number; total: number };
  metadataHasUnchecked: boolean;
  metadataIssuesCount: number;
  canRefresh: boolean;
  canRefreshFromDevice: boolean;
  isRefreshing: boolean;
  isRefreshingFromDevice: boolean;
  needsAttention?: boolean;
  hasBackgroundScan?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:query', value: string): void;
  (e: 'metadata-search'): void;
  (e: 'metadata-cancel'): void;
  (e: 'metadata-reset'): void;
  (e: 'open-issues'): void;
  (e: 'refresh-cloud'): void;
  (e: 'refresh-device'): void;
  (e: 'cancel-background-scan'): void;
}>();

const hasMetadataEdits = computed(() => {
  return props.tracks.some((t) => t.hasMetadataEdits);
});

function onQueryUpdate(value: string): void {
  emit('update:query', value);
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
        <MetadataCandidatesButton :tracks="tracks" />

        <!-- Передаем hasEdits -->
        <MetadataMenu
          :is-loading="metadataLoading"
          :progress="metadataProgress"
          :stats="metadataStats"
          :has-unchecked="metadataHasUnchecked"
          :issues-count="metadataIssuesCount"
          :has-edits="hasMetadataEdits"
          @search="emit('metadata-search')"
          @cancel="emit('metadata-cancel')"
          @reset="emit('metadata-reset')"
          @open-issues="emit('open-issues')"
        />

        <template v-if="canRefresh || canRefreshFromDevice">
          <Divider :vertical="true" with-margin />
          <FolderSyncMenu
            :can-refresh="canRefresh"
            :can-refresh-from-device="canRefreshFromDevice"
            :is-refreshing="isRefreshing"
            :is-refreshing-from-device="isRefreshingFromDevice"
            :needs-attention="needsAttention"
            :has-background-scan="hasBackgroundScan"
            @refresh-cloud="emit('refresh-cloud')"
            @refresh-device="emit('refresh-device')"
            @cancel-background-scan="emit('cancel-background-scan')"
          />
        </template>

        <FolderSettingsMenu />
      </div>
    </div>
  </div>
</template>
