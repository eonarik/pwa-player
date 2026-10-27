<!-- src/views/HistoryView.vue -->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useHistoryStore } from '@/stores/history'
import { useLibraryStore } from '@/stores/library'
import { usePlayerStore } from '@/stores/player'
import { useUiSettingsStore } from '@/stores/uiSettings'
import { useLibrarySearch } from '@/composables/useLibrarySearch'
import { useResolvedTracks } from '@/composables/useResolvedTracks'
import { pluralize } from '@/utils/pluralize'
import { formatRelativeTime } from '@/utils/formatRelativeTime'
import TrackListItem from '@/components/library/TrackListItem.vue'
import TrackActions from '@/components/library/TrackActions.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import ShowSourceCheckbox from '@/components/ui/ShowSourceCheckbox.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import Button from '@/components/ui/Button.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ListContainer from '@/components/ui/ListContainer.vue'
import Icon from '@/components/ui/Icon.vue'
import type { LibraryTrack } from '@/types/library'
import type { Track } from '@/types/track'
import BatchAddToPlaylistButton from "@/components/library/BatchAddToPlaylistButton.vue"

const history = useHistoryStore()
const library = useLibraryStore()
const player = usePlayerStore()
const uiSettings = useUiSettingsStore()

const { uniqueHistory, isEmpty } = storeToRefs(history)
const { currentTrack, isPlaying } = storeToRefs(player)

const showUniqueOnly = ref(true)

const visibleHistory = computed(() => {
  return showUniqueOnly.value ? uniqueHistory.value : history.sortedHistory
})

// Используем общий composable для сборки треков
const resolvedTracks = useResolvedTracks(visibleHistory)

// Для поиска и метаданных используем только те треки, что есть в библиотеке
const searchableTracks = computed<LibraryTrack[]>(() => {
  return resolvedTracks.value.filter((t): t is LibraryTrack => {
    return Boolean(library.getTrack(t.id))
  })
})

const { query, hasQuery, hasResults, result } = useLibrarySearch(
  searchableTracks,
  uiSettings.searchThreshold,
)

const searchFlatTracks = computed<Track[]>(() => result.value.tracks)

function onSelectSearchTrack(trackId: string) {
  const idx = searchFlatTracks.value.findIndex((t) => t.id === trackId)
  if (idx < 0) return
  player.setQueue(searchFlatTracks.value, idx)
}

function isSearchCurrent(trackId: string): boolean {
  return currentTrack.value?.id === trackId
}

function clearHistory() {
  const confirmed = window.confirm('Очистить всю историю воспроизведения?')
  if (!confirmed) return
  history.clear()
}

function playAll() {
  if (resolvedTracks.value.length === 0) return
  player.playAll(resolvedTracks.value)
}

function onSelectTrack(index: number) {
  if (index < 0) return
  player.setQueue(resolvedTracks.value, index)
}

function isCurrent(trackId: string): boolean {
  return currentTrack.value?.id === trackId
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <PageHeader title="История" :subtitle="pluralize(visibleHistory.length, ['запись', 'записи', 'записей'])">
      <ShowSourceCheckbox />
      <BatchAddToPlaylistButton :tracks="resolvedTracks" />
      <Button v-if="!isEmpty" variant="primary" size="sm" @click="playAll">Играть всё</Button>
      <Button v-if="!isEmpty" variant="danger" size="sm" @click="clearHistory">Очистить</Button>
    </PageHeader>

    <div v-if="!isEmpty" class="flex shrink-0 items-center gap-2 px-4 py-2">
      <div class="mx-auto flex w-full max-w-3xl items-center gap-3">
        <SearchInput v-model="query" />

        <div class="flex items-center gap-2">
          <button type="button" class="rounded-btn px-2 py-1 text-xs transition"
            :class="showUniqueOnly ? 'bg-card-bg text-fg' : 'text-fg-muted hover:text-fg'"
            @click="showUniqueOnly = true">
            Уникальные
          </button>
          <button type="button" class="rounded-btn px-2 py-1 text-xs transition"
            :class="!showUniqueOnly ? 'bg-card-bg text-fg' : 'text-fg-muted hover:text-fg'"
            @click="showUniqueOnly = false">
            Все
          </button>
        </div>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto">
      <div class="mx-auto w-full max-w-3xl p-2">
        <EmptyState v-if="isEmpty" title="История пуста">
          <template #icon>
            <Icon name="history" w="w-10" h="h-10" />
          </template>
        </EmptyState>

        <template v-else-if="hasQuery">
          <EmptyState v-if="!hasResults" title="Ничего не найдено">
            <template #icon>
              <Icon name="search" w="w-10" h="h-10" />
            </template>
          </EmptyState>

          <div v-else class="flex flex-col gap-4">
            <div v-for="group in result.groups" :key="group.artist">
              <p class="px-5 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wider text-fg-subtle">
                {{ group.artist }}
              </p>

              <ListContainer max-width="lg">
                <TrackListItem v-for="track in group.tracks" :key="track.id" :track="track"
                  :index="searchFlatTracks.findIndex((t) => t.id === track.id)" :is-current="isSearchCurrent(track.id)"
                  :is-playing="isPlaying" @select="() => onSelectSearchTrack(track.id)">
                  <template #actions>
                    <TrackActions :track="track" />
                  </template>
                </TrackListItem>
              </ListContainer>
            </div>
          </div>
        </template>

        <ListContainer v-else max-width="lg">
          <TrackListItem v-for="(track, index) in resolvedTracks" :key="`${track.id}-${index}`" :track="track"
            :index="index" :is-current="isCurrent(track.id)" :is-playing="isPlaying"
            @select="() => onSelectTrack(index)">
            <template #actions>
              <span v-if="visibleHistory[index]" class="mr-2 text-[10px] tabular-nums text-fg-subtle">
                {{ formatRelativeTime(visibleHistory[index]!.playedAt) }}
              </span>
              <TrackActions :track="track" />
            </template>
          </TrackListItem>
        </ListContainer>
      </div>
    </div>
  </div>
</template>
