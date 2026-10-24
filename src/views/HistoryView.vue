<!-- src/views/HistoryView.vue -->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useHistoryStore } from '@/stores/history'
import { useLibraryStore } from '@/stores/library'
import { usePlayerStore } from '@/stores/player'
import { useUiSettingsStore } from '@/stores/uiSettings'
import { useLibrarySearch } from '@/composables/useLibrarySearch'
import { pluralize } from '@/utils/pluralize'
import { formatRelativeTime } from '@/utils/formatRelativeTime'
import TrackResolvedItem from '@/components/library/TrackResolvedItem.vue'
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
import type { PlayHistoryEntry } from '@/types/history'

const history = useHistoryStore()
const library = useLibraryStore()
const player = usePlayerStore()
const uiSettings = useUiSettingsStore()

const { uniqueHistory, isEmpty } = storeToRefs(history)
const { currentTrack, isPlaying } = storeToRefs(player)

const showUniqueOnly = ref(true)

const visibleHistory = computed<PlayHistoryEntry[]>(() => {
  return showUniqueOnly.value ? uniqueHistory.value : history.sortedHistory
})

const resolvedTracks = computed<LibraryTrack[]>(() => {
  const result: LibraryTrack[] = []
  for (const entry of visibleHistory.value) {
    const track = library.getTrack(entry.trackId)
    if (track) result.push(track)
  }
  return result
})

const { query, hasQuery, hasResults, result } = useLibrarySearch(
  resolvedTracks,
  uiSettings.searchThreshold,
)

const searchFlatTracks = computed<LibraryTrack[]>(() => result.value.tracks)

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
          <TrackResolvedItem v-for="(entry, index) in visibleHistory" :key="`${entry.trackId}-${entry.playedAt}`"
            :track-id="entry.trackId" :index="index" :is-current="isCurrent(entry.trackId)" :is-playing="isPlaying"
            :meta-label="formatRelativeTime(entry.playedAt)" :snapshot="entry"
            @select="onSelectTrack(resolvedTracks.findIndex((t) => t.id === entry.trackId))" />
        </ListContainer>
      </div>
    </div>
  </div>
</template>
