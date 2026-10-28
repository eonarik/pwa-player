<!-- src/components/library/TrackListPage.vue -->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useLibraryStore } from '@/stores/library'
import { usePlayerStore } from '@/stores/player'
import { useUiSettingsStore } from '@/stores/uiSettings'
import { getPluginName } from '@/plugins/lookup'
import { pluginIdFromSource } from '@/plugins/registry'
import { useLibrarySearch } from '@/composables/useLibrarySearch'
import SearchInput from '@/components/ui/SearchInput.vue'
import FileLocationFilter from './FileLocationFilter.vue'
import type { FilterOption } from '@/types/filter'
import TrackListItem from './TrackListItem.vue'
import TrackActions from './TrackActions.vue'
import BatchAddToPlaylistButton from './BatchAddToPlaylistButton.vue'
import AlternatesButton from './AlternatesButton.vue' // <-- ДОБАВЛЕНО
import Button from '@/components/ui/Button.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ListContainer from '@/components/ui/ListContainer.vue'
import Icon from '@/components/ui/Icon.vue'
import type { LibraryTrack } from '@/types/library'
import type { Track } from '@/types/track'

const props = withDefaults(
  defineProps<{
    title: string
    subtitle?: string
    tracks: Track[]
    showSearch?: boolean
    showFilter?: boolean
    showPlayAll?: boolean
    showBatchAdd?: boolean
    preFilter?: (t: Track) => boolean
    customSelect?: boolean
    itemKey?: (track: Track, index: number) => string
  }>(),
  {
    showSearch: true,
    showFilter: true,
    showPlayAll: true,
    showBatchAdd: true,
    customSelect: false,
    itemKey: (track: Track) => track.id,
  },
)

const emit = defineEmits<{
  (e: 'select-track', index: number): void
  (e: 'select-search-track', trackId: string): void
}>()

const library = useLibraryStore()
const player = usePlayerStore()
const uiSettings = useUiSettingsStore()
const { currentTrack, isPlaying } = storeToRefs(player)

const sourceFilter = ref<string>('all')

const baseTracks = computed<Track[]>(() => props.tracks)

const preFilteredTracks = computed(() => {
  if (!props.preFilter) return baseTracks.value
  return baseTracks.value.filter(props.preFilter)
})

const filterOptions = computed<FilterOption[]>(() => {
  const plugins = new Set<string>()
  for (const t of preFilteredTracks.value) {
    plugins.add(pluginIdFromSource(t.pluginId))
  }
  return Array.from(plugins).map((id) => ({
    id,
    label: getPluginName(id),
  }))
})

const filteredTracks = computed(() => {
  if (sourceFilter.value === 'all') return preFilteredTracks.value
  return preFilteredTracks.value.filter(
    (t) => pluginIdFromSource(t.pluginId) === sourceFilter.value,
  )
})

const searchableTracks = computed<LibraryTrack[]>(() => {
  return filteredTracks.value.filter((t): t is LibraryTrack => Boolean(library.getTrack(t.id)))
})

const { query: searchQuery, hasQuery, hasResults, result } = useLibrarySearch(
  searchableTracks,
  uiSettings.searchThreshold,
)

const currentQuery = computed({
  get: () => searchQuery.value,
  set: (v) => {
    searchQuery.value = v
  },
})

const searchFlatTracks = computed<Track[]>(() => result.value.tracks)

const currentTrackId = computed(() => currentTrack.value?.id ?? null)

function isCurrent(trackId: string) {
  return currentTrackId.value === trackId
}

function playAll() {
  if (filteredTracks.value.length === 0) return
  player.playAll(filteredTracks.value)
}

function onSelect(index: number) {
  emit('select-track', index)
  if (!props.customSelect) {
    player.setQueue(filteredTracks.value, index)
  }
}

function onSelectSearch(trackId: string) {
  emit('select-search-track', trackId)
  if (props.customSelect) return
  const idx = searchFlatTracks.value.findIndex((t) => t.id === trackId)
  if (idx < 0) return
  player.setQueue(searchFlatTracks.value, idx)
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <div class="flex shrink-0 items-center justify-between gap-3 px-4 py-3 border-b border-hover-bg bg-bg z-30">
      <div class="mx-auto flex w-full max-w-3xl items-center justify-between gap-3">
        <div class="min-w-0">
          <h1 class="truncate text-lg font-medium text-fg">{{ title }}</h1>
          <p v-if="subtitle" class="text-xs text-fg-muted">{{ subtitle }}</p>
        </div>

        <div class="flex shrink-0 items-center gap-2">
          <!-- <-- ДОБАВЛЕНО: Кнопка альтернатив -->
          <AlternatesButton :tracks="filteredTracks" />

          <slot name="header-actions" />
        </div>
      </div>
    </div>

    <div v-if="showSearch || showFilter || showPlayAll || showBatchAdd"
      class="shrink-0 px-4 py-2 border-b border-hover-bg bg-bg">
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

          <div v-else class="flex flex-col gap-4">
            <div v-for="group in result.groups" :key="group.artist">
              <p class="px-5 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wider text-fg-subtle">
                {{ group.artist }}
              </p>
              <ListContainer max-width="lg">
                <TrackListItem v-for="track in group.tracks" :key="track.id" :track="track"
                  :index="searchFlatTracks.findIndex((t) => t.id === track.id)" :is-current="isCurrent(track.id)"
                  :is-playing="isPlaying" @select="() => onSelectSearch(track.id)">
                  <template #actions>
                    <slot name="track-actions" :track="track"
                      :index="searchFlatTracks.findIndex((t) => t.id === track.id)">
                      <TrackActions :track="track" />
                    </slot>
                  </template>
                </TrackListItem>
              </ListContainer>
            </div>
          </div>
        </template>

        <ListContainer v-else max-width="lg">
          <TrackListItem v-for="(track, index) in filteredTracks" :key="itemKey(track, index)" :track="track"
            :index="index" :is-current="isCurrent(track.id)" :is-playing="isPlaying" @select="() => onSelect(index)">
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
