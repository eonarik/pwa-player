<!-- src/views/SearchView.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useLibraryStore } from '@/stores/library'
import { usePlayerStore } from '@/stores/player'
import { useUiSettingsStore } from '@/stores/uiSettings'
import { useLibrarySearch } from '@/composables/useLibrarySearch'
import SearchInput from '@/components/ui/SearchInput.vue'
import TrackListItem from '@/components/library/TrackListItem.vue'
import TrackActions from '@/components/library/TrackActions.vue'
import ShowSourceCheckbox from '@/components/ui/ShowSourceCheckbox.vue'
import type { LibraryTrack } from '@/types/library'

const library = useLibraryStore()
const player = usePlayerStore()
const uiSettings = useUiSettingsStore()

const { currentTrack, isPlaying } = storeToRefs(player)

const allTracks = computed<LibraryTrack[]>(() => Object.values(library.tracks))

const { query, hasQuery, hasResults, result } = useLibrarySearch(
  allTracks,
  uiSettings.searchThreshold,
)

const flatTracks = computed<LibraryTrack[]>(() => result.value.tracks)

function playAll() {
  if (flatTracks.value.length === 0) return
  player.setQueue(flatTracks.value, 0)
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
    <!-- Шапка -->
    <div class="flex shrink-0 items-center justify-between gap-3 px-4 py-3">
      <div class="mx-auto flex w-full max-w-3xl items-center justify-between gap-3">
        <h1 class="text-lg font-medium text-fg">Поиск</h1>

        <div class="flex shrink-0 items-center gap-2">
          <ShowSourceCheckbox />
        </div>
      </div>
    </div>

    <!-- Поиск -->
    <div class="shrink-0 px-4 py-2">
      <div class="mx-auto w-full max-w-3xl">
        <SearchInput v-model="query" always-open />
      </div>
    </div>

    <!-- Контент -->
    <div class="flex-1 overflow-y-auto">
      <div class="mx-auto w-full max-w-3xl p-2">
        <div
          v-if="!hasQuery"
          class="flex h-full items-center justify-center py-20 text-sm text-fg-muted"
        >
          Начните вводить запрос
        </div>

        <div
          v-else-if="!hasResults"
          class="flex h-full items-center justify-center py-20 text-sm text-fg-muted"
        >
          Ничего не найдено
        </div>

        <template v-else>
          <div class="mb-3 flex items-center justify-between gap-3 px-3">
            <span class="text-xs text-fg-muted">
              Найдено: {{ flatTracks.length }} · Групп: {{ result.groups.length }}
            </span>

            <button
              type="button"
              class="rounded-btn bg-accent px-3 py-1.5 text-xs font-medium text-bg transition hover:bg-accent-hover"
              @click="playAll"
            >
              Играть всё
            </button>
          </div>

          <div class="flex flex-col gap-4">
            <div v-for="group in result.groups" :key="group.artist">
              <p
                class="px-5 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wider text-fg-subtle"
              >
                {{ group.artist }}
              </p>

              <div class="flex flex-col gap-0.5">
                <TrackListItem
                  v-for="track in group.tracks"
                  :key="track.id"
                  :track="track"
                  :index="flatTracks.findIndex((t) => t.id === track.id)"
                  :is-current="isCurrent(track.id)"
                  :is-playing="isPlaying"
                  @select="() => onSelectTrack(track.id)"
                >
                  <template #actions>
                    <TrackActions :track="track" />
                  </template>
                </TrackListItem>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
