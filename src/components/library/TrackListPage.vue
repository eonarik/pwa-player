<!-- src/components/library/TrackListPage.vue -->

<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useLibraryStore } from '@/stores/library';
import { usePlayerStore } from '@/stores/player';
import { useUiSettingsStore } from '@/stores/uiSettings';
import { useLibrarySearch } from '@/composables/useLibrarySearch';
import { useTrackFilter } from '@/composables/useTrackFilter';
import { useCollectionActions } from '@/composables/useCollectionActions';
import SearchInput from '@/components/molecules/SearchInput.vue';
import FileLocationFilter from './FileLocationFilter.vue';
import TrackListItem from './TrackListItem.vue';
import TrackActions from './TrackActions.vue';
import TrackListHeader from './TrackListHeader.vue';
import TrackSearchResults from './TrackSearchResults.vue';
import BatchAddToPlaylistButton from './BatchAddToPlaylistButton.vue';
import MetadataCandidatesButton from './MetadataCandidatesButton.vue';
import Button from '@/components/atoms/Button.vue';
import EmptyState from '@/components/molecules/EmptyState.vue';
import ListContainer from '@/components/molecules/ListContainer.vue';
import Icon from '@/components/atoms/Icon.vue';
import type { Track } from '@/types/track';
import type { PluginCollectionAction } from '@/plugins/types';

const props = withDefaults(
  defineProps<{
    title: string;
    subtitle?: string;
    tracks: Track[];
    showSearch?: boolean;
    showFilter?: boolean;
    showPlayAll?: boolean;
    showBatchAdd?: boolean;
    preFilter?: (t: Track) => boolean;
    customSelect?: boolean;
    itemKey?: (track: Track, index: number) => string;
  }>(),
  {
    showSearch: true,
    showFilter: true,
    showPlayAll: true,
    showBatchAdd: true,
    customSelect: false,
    itemKey: (track: Track) => track.id,
  },
);

const emit = defineEmits<{
  (e: 'select-track', index: number): void;
  (e: 'select-search-track', trackId: string): void;
}>();

const library = useLibraryStore();
const player = usePlayerStore();
const uiSettings = useUiSettingsStore();
const { currentTrack, isPlaying } = storeToRefs(player);

const currentTrackId = computed(() => currentTrack.value?.id ?? null);

function isCurrent(trackId: string) {
  return currentTrackId.value === trackId;
}

// --- Filtering ---

const { sourceFilter, filterOptions, filteredTracks } = useTrackFilter(
  computed(() => props.tracks),
  props.preFilter,
);

// --- Search ---

const searchableTracks = computed<Track[]>(() => {
  return filteredTracks.value.filter((t) => Boolean(library.getTrack(t.id)));
});

const {
  query: searchQuery,
  hasQuery,
  hasResults,
  result,
} = useLibrarySearch(searchableTracks, uiSettings.searchThreshold);

const currentQuery = computed({
  get: () => searchQuery.value,
  set: (v) => {
    searchQuery.value = v;
  },
});

const searchFlatTracks = computed<Track[]>(() => result.value.tracks);

// --- Player actions ---

function playAll() {
  if (filteredTracks.value.length === 0) return;
  player.playAll(filteredTracks.value);
}

function onSelect(index: number) {
  emit('select-track', index);
  if (!props.customSelect) {
    player.setQueue(filteredTracks.value, index);
  }
}

function onSelectSearch(trackId: string) {
  emit('select-search-track', trackId);
  if (props.customSelect) return;
  const idx = searchFlatTracks.value.findIndex((t) => t.id === trackId);
  if (idx < 0) return;
  player.setQueue(searchFlatTracks.value, idx);
}

// --- Collection actions ---

const { visibleCollectionActions, actionProgress, runAction } = useCollectionActions(filteredTracks);

async function onRunCollectionAction(action: PluginCollectionAction) {
  await runAction(action, filteredTracks.value);
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <TrackListHeader
      :title="title"
      :subtitle="subtitle"
      :visible-collection-actions="visibleCollectionActions"
      :action-progress="actionProgress"
      @run-action="onRunCollectionAction"
    >
      <template #header-actions>
        <MetadataCandidatesButton :tracks="filteredTracks" />
        <slot name="header-actions" />
      </template>
    </TrackListHeader>

    <div
      v-if="showSearch || showFilter || showPlayAll || showBatchAdd"
      class="shrink-0 px-4 py-2 border-b border-hover-bg bg-bg"
    >
      <div class="mx-auto flex w-full max-w-3xl flex-col gap-3">
        <div class="flex items-center gap-3">
          <SearchInput v-if="showSearch" v-model="currentQuery" class="flex-1" />
          <div v-if="showPlayAll || showBatchAdd" class="flex shrink-0 items-center gap-2">
            <BatchAddToPlaylistButton v-if="showBatchAdd" :tracks="filteredTracks" />
            <Button v-if="showPlayAll && filteredTracks.length > 0" variant="primary" size="sm" @click="playAll">
              Играть всё
            </Button>
          </div>
        </div>
        <div v-if="showFilter && filterOptions.length > 1" class="flex items-center gap-2">
          <FileLocationFilter v-model="sourceFilter" :options="filterOptions" />
        </div>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto">
      <div class="mx-auto w-full max-w-3xl py-2">
        <slot v-if="filteredTracks.length === 0 && !hasQuery" name="empty">
          <EmptyState title="Список пуст">
            <template #icon>
              <Icon name="music" w="w-10" h="w-10" />
            </template>
          </EmptyState>
        </slot>

        <template v-else-if="hasQuery">
          <EmptyState v-if="!hasResults" title="Ничего не найдено">
            <template #icon>
              <Icon name="search" w="w-10" h="w-10" />
            </template>
          </EmptyState>

          <TrackSearchResults
            v-else
            :groups="result.groups"
            :flat-tracks="searchFlatTracks"
            :is-current="isCurrent"
            :is-playing="isPlaying"
            @select-track="onSelectSearch"
          >
            <template #track-actions="{ track, index }">
              <slot name="track-actions" :track="track" :index="index">
                <TrackActions :track="track" />
              </slot>
            </template>
          </TrackSearchResults>
        </template>

        <ListContainer v-else max-width="lg">
          <TrackListItem
            v-for="(track, index) in filteredTracks"
            :key="itemKey(track, index)"
            :track="track"
            :index="index"
            :is-current="isCurrent(track.id)"
            :is-playing="isPlaying"
            @select="() => onSelect(index)"
          >
            <template #actions>
              <slot name="track-meta" :track="track" :index="index" />
              <slot name="track-actions" :track="track" :index="index">
                <TrackActions :track="track" />
              </slot>
            </template>
          </TrackListItem>
        </ListContainer>
      </div>
    </div>
  </div>
</template>
