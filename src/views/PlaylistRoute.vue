<!-- src/views/PlaylistRoute.vue -->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { usePlaylistsStore } from '@/stores/playlists'
import { useLibraryStore } from '@/stores/library'
import { usePlayerStore } from '@/stores/player'
import { useUiSettingsStore } from '@/stores/uiSettings'
import { useLibrarySearch } from '@/composables/useLibrarySearch'
import { useMetadataSearch } from '@/composables/useMetadataSearch'
import { FAVORITES_PLAYLIST_ID } from '@/types/playlist'
import { pluralize } from '@/utils/pluralize'
import { sortService } from '@/services/sort/SortService'
import TrackResolvedItem from '@/components/library/TrackResolvedItem.vue'
import TrackListItem from '@/components/library/TrackListItem.vue'
import TrackActions from '@/components/library/TrackActions.vue'
import BatchDownloadButton from '@/components/library/BatchDownloadButton.vue'
import MetadataMenu from '@/components/library/MetadataMenu.vue'
import MetadataIssuesModal from '@/components/library/MetadataIssuesModal.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import IconPencil from '@/components/icons/IconPencil.vue'
import IconTrash from '@/components/icons/IconTrash.vue'
import type { LibraryTrack } from '@/types/library'

const route = useRoute()
const router = useRouter()
const playlists = usePlaylistsStore()
const library = useLibraryStore()
const player = usePlayerStore()
const uiSettings = useUiSettingsStore()

const { currentTrack, isPlaying } = storeToRefs(player)

const playlistId = computed(() => String(route.params.id))
const playlist = computed(() => playlists.getPlaylist(playlistId.value))

const isRenaming = ref(false)
const renameValue = ref('')

const isFavorites = computed(() => playlistId.value === FAVORITES_PLAYLIST_ID)

const resolvedTracks = computed<LibraryTrack[]>(() => {
  if (!playlist.value) return []
  const result: LibraryTrack[] = []
  for (const snapshot of playlist.value.tracks) {
    const track = library.getTrack(snapshot.trackId)
    if (track) result.push(track)
  }
  return sortService.sort(result)
})

const unavailableCount = computed(() => {
  if (!playlist.value) return 0
  return playlist.value.tracks.length - resolvedTracks.value.length
})

// --- Поиск -----------------------------------------------------------

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

// --- Поиск метаданных -----------------------------------------------

const {
  isLoading: isMetadataLoading,
  progress: metadataProgress,
  stats: metadataStats,
  hasUnchecked: metadataHasUnchecked,
  issues: metadataIssues,
  search: metadataSearch,
  cancel: metadataCancel,
  reset: metadataReset,
  dismissIssues: metadataDismissIssues,
} = useMetadataSearch(resolvedTracks)

const showMetadataIssues = ref(false)

function openMetadataIssues() {
  showMetadataIssues.value = true
}

function closeMetadataIssues() {
  showMetadataIssues.value = false
  metadataDismissIssues()
}

// --- Действия -------------------------------------------------------

function startRename() {
  if (!playlist.value || isFavorites.value) return
  renameValue.value = playlist.value.name
  isRenaming.value = true
}

function confirmRename() {
  if (!playlist.value) return
  playlists.renamePlaylist(playlist.value.id, renameValue.value)
  isRenaming.value = false
}

function cancelRename() {
  isRenaming.value = false
  renameValue.value = ''
}

function deletePlaylist() {
  if (!playlist.value || isFavorites.value) return
  const confirmed = window.confirm(`Удалить плейлист «${playlist.value.name}»?`)
  if (!confirmed) return
  playlists.deletePlaylist(playlist.value.id)
  router.replace({ name: 'playlists' })
}

function onSelectTrack(index: number) {
  if (index < 0) return
  player.setQueue(resolvedTracks.value, index)
}

function isCurrent(trackId: string): boolean {
  return currentTrack.value?.id === trackId
}

function onRemoved() {
  // стор пересчитается сам
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <div v-if="!playlist" class="flex h-full flex-col items-center justify-center gap-3 text-sm text-fg-muted">
      <p>Плейлист не найден</p>
      <RouterLink :to="{ name: 'playlists' }"
        class="rounded-btn bg-accent px-4 py-2 text-sm font-medium text-bg transition hover:bg-accent-hover">
        К плейлистам
      </RouterLink>
    </div>

    <template v-else>
      <!-- Шапка: строка 1 -->
      <div class="flex shrink-0 items-center justify-between gap-3 px-4 pt-3">
        <div class="mx-auto flex w-full max-w-3xl items-center justify-between gap-3">
          <div class="flex min-w-0 flex-1 items-center gap-2">
            <template v-if="isRenaming">
              <form class="flex flex-1 items-center gap-2" @submit.prevent="confirmRename">
                <input v-model="renameValue" type="text" autofocus
                  class="flex-1 rounded-btn bg-card-bg px-3 py-1.5 text-sm text-fg focus:bg-hover-bg focus:outline-none"
                  @keydown.esc="cancelRename" />
                <button type="submit"
                  class="rounded-btn bg-accent px-3 py-1.5 text-xs font-medium text-bg transition hover:bg-accent-hover">
                  ОК
                </button>
                <button type="button"
                  class="rounded-btn bg-card-bg px-3 py-1.5 text-xs text-fg transition hover:bg-hover-bg"
                  @click="cancelRename">
                  Отмена
                </button>
              </form>
            </template>

            <template v-else>
              <h1 class="truncate text-lg font-medium text-fg">{{ playlist.name }}</h1>

              <button v-if="!isFavorites" type="button"
                class="rounded-btn p-1 text-fg-subtle transition hover:bg-hover-bg hover:text-fg"
                aria-label="Переименовать" @click="startRename">
                <IconPencil class="h-3.5 w-3.5" />
              </button>
            </template>
          </div>

          <div class="flex shrink-0 items-center gap-2">
            <span class="text-xs text-fg-muted">
              <template v-if="unavailableCount > 0">
                {{ resolvedTracks.length }} из {{ playlist.tracks.length }}
              </template>
              <template v-else>
                {{ pluralize(resolvedTracks.length, ['трек', 'трека', 'треков']) }}
              </template>
            </span>

            <BatchDownloadButton :tracks="resolvedTracks" />
          </div>
        </div>
      </div>

      <!-- Шапка: строка 2 -->
      <div class="flex shrink-0 items-center justify-between gap-3 px-4 py-2">
        <div class="mx-auto flex w-full max-w-3xl items-center justify-between gap-3">
          <div class="flex items-center gap-1">
            <SearchInput v-model="query" />
          </div>

          <div class="flex shrink-0 items-center gap-2">
            <MetadataMenu :is-loading="isMetadataLoading" :progress="metadataProgress" :stats="metadataStats"
              :has-unchecked="metadataHasUnchecked" :issues-count="metadataIssues.length" @search="metadataSearch"
              @cancel="metadataCancel" @reset="metadataReset" @open-issues="openMetadataIssues" />

            <button v-if="!isFavorites" type="button"
              class="rounded-btn p-1.5 text-fg-subtle transition hover:bg-hover-bg hover:text-red-400"
              aria-label="Удалить плейлист" @click="deletePlaylist">
              <IconTrash class="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <!-- Контент -->
      <div class="flex-1 overflow-y-auto">
        <div class="mx-auto w-full max-w-3xl">
          <div v-if="playlist.tracks.length === 0"
            class="flex h-full items-center justify-center py-20 text-sm text-fg-muted">
            Плейлист пуст
          </div>

          <!-- Режим поиска -->
          <template v-else-if="hasQuery">
            <div class="p-2">
              <div v-if="!hasResults" class="flex h-full items-center justify-center py-20 text-sm text-fg-muted">
                Ничего не найдено
              </div>

              <div v-else class="flex flex-col gap-4">
                <div v-for="group in result.groups" :key="group.artist">
                  <p class="px-5 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wider text-fg-subtle">
                    {{ group.artist }}
                  </p>

                  <div class="flex flex-col gap-0.5">
                    <TrackListItem v-for="track in group.tracks" :key="track.id" :track="track"
                      :index="searchFlatTracks.findIndex((t) => t.id === track.id)"
                      :is-current="isSearchCurrent(track.id)" :is-playing="isPlaying"
                      @select="() => onSelectSearchTrack(track.id)">
                      <template #actions>
                        <TrackActions :track="track" />
                      </template>
                    </TrackListItem>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <!-- Обычный режим -->
          <div v-else class="flex flex-col gap-0.5 -mx-2.5 p-2">
            <TrackResolvedItem v-for="(snapshot, index) in playlist.tracks" :key="snapshot.trackId"
              :track-id="snapshot.trackId" :index="index" :is-current="isCurrent(snapshot.trackId)"
              :is-playing="isPlaying" :playlist-id="playlist.id"
              @select="onSelectTrack(resolvedTracks.findIndex((t) => t.id === snapshot.trackId))"
              @removed="onRemoved" />
          </div>
        </div>
      </div>

      <MetadataIssuesModal v-if="showMetadataIssues" :issues="metadataIssues" @close="closeMetadataIssues" />
    </template>
  </div>
</template>
