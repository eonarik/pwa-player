<!-- src/views/SearchView.vue -->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useLibraryStore } from '@/stores/library'
import { usePlayerStore } from '@/stores/player'
import { useUiSettingsStore } from '@/stores/uiSettings'
import { useLibrarySearch } from '@/composables/useLibrarySearch'
import SearchInput from '@/components/ui/SearchInput.vue'
import TrackListItem from '@/components/library/TrackListItem.vue'
import TrackActions from '@/components/library/TrackActions.vue'
import ShowSourceCheckbox from '@/components/ui/ShowSourceCheckbox.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import Button from '@/components/ui/Button.vue'
import ListContainer from '@/components/ui/ListContainer.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Icon from '@/components/ui/Icon.vue'
import type { LibraryTrack } from '@/types/library'

const library = useLibraryStore()
const player = usePlayerStore()
const uiSettings = useUiSettingsStore()

const { currentTrack, isPlaying } = storeToRefs(player)

type SourceFilter = 'all' | 'local' | 'cloud'
const sourceFilter = ref<SourceFilter>('all')

const FILTERS: Array<{ id: SourceFilter; label: string }> = [
  { id: 'all', label: 'Все' },
  { id: 'local', label: 'Локальные' },
  { id: 'cloud', label: 'Облако' },
]

const allTracks = computed<LibraryTrack[]>(() => Object.values(library.tracks))

// Показывать фильтр только если есть разные локации
const hasMixedLocations = computed(() => {
  if (allTracks.value.length === 0) return false
  const locations = new Set(allTracks.value.map((t) => t.fileLocation ?? 'remote-only'))
  return locations.size > 1
})

const filteredTracks = computed<LibraryTrack[]>(() => {
  if (sourceFilter.value === 'all') return allTracks.value

  return allTracks.value.filter((t) => {
    const loc = t.fileLocation ?? 'remote-only'
    if (sourceFilter.value === 'local') {
      return loc === 'local-only' || loc === 'both'
    }
    return loc === 'remote-only' || loc === 'both'
  })
})

const { query, hasQuery, hasResults, result } = useLibrarySearch(
  filteredTracks,
  uiSettings.searchThreshold,
)

const flatTracks = computed<LibraryTrack[]>(() => result.value.tracks)

function playAll() {
  if (flatTracks.value.length === 0) return
  player.playAll(flatTracks.value)
}

function onSelectTrack(trackId: string) {
  const idx = flatTracks.value.findIndex((t) => t.id === trackId)
  if (idx < 0) return
  player.setQueue(flatTracks.value, idx)
}

function isCurrent(trackId: string): boolean {
  return currentTrack.value?.id === trackId
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <PageHeader title="Поиск">
      <ShowSourceCheckbox />
    </PageHeader>

    <div class="shrink-0 px-4 py-2">
      <div class="mx-auto flex w-full max-w-3xl flex-col gap-3">
        <SearchInput v-model="query" always-open />

        <div v-if="hasMixedLocations" class="flex items-center gap-2">
          <button v-for="f in FILTERS" :key="f.id" type="button" class="rounded-btn px-3 py-1 text-xs transition"
            :class="sourceFilter === f.id ? 'bg-card-bg text-fg font-medium' : 'text-fg-muted hover:text-fg hover:bg-hover-bg'"
            @click="sourceFilter = f.id">
            {{ f.label }}
          </button>
        </div>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto">
      <div class="mx-auto w-full max-w-3xl py-2">
        <EmptyState v-if="!hasQuery" title="Начните вводить запрос">
          <template #icon>
            <Icon name="search" w="w-10" h="h-10" />
          </template>
        </EmptyState>

        <EmptyState v-else-if="!hasResults" title="Ничего не найдено">
          <template #icon>
            <Icon name="search" w="w-10" h="h-10" />
          </template>
        </EmptyState>

        <template v-else>
          <div class="mb-3 flex items-center justify-between gap-3 px-3">
            <span class="text-xs text-fg-muted">
              Найдено: {{ flatTracks.length }} · Групп: {{ result.groups.length }}
            </span>
            <Button variant="primary" size="sm" @click="playAll">Играть всё</Button>
          </div>

          <div class="flex flex-col gap-4">
            <div v-for="group in result.groups" :key="group.artist">
              <p class="px-5 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wider text-fg-subtle">
                {{ group.artist }}
              </p>
              <ListContainer max-width="lg" class="!px-0">
                <TrackListItem v-for="track in group.tracks" :key="track.id" :track="track"
                  :index="flatTracks.findIndex((t) => t.id === track.id)" :is-current="isCurrent(track.id)"
                  :is-playing="isPlaying" @select="() => onSelectTrack(track.id)">
                  <template #actions>
                    <TrackActions :track="track" />
                  </template>
                </TrackListItem>
              </ListContainer>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
