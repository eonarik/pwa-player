<!-- src/views/PlaylistRoute.vue -->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { usePlaylistsStore } from '@/stores/playlists'
import { useLibraryStore } from '@/stores/library'
import { usePlayerStore } from '@/stores/player'
import { FAVORITES_PLAYLIST_ID } from '@/types/playlist'
import TrackListItem from '@/components/library/TrackListItem.vue'
import TrackActions from '@/components/library/TrackActions.vue'
import type { LibraryTrack } from '@/types/library'

const route = useRoute()
const router = useRouter()
const playlists = usePlaylistsStore()
const library = useLibraryStore()
const player = usePlayerStore()

const { currentTrack, isPlaying } = storeToRefs(player)

const playlistId = computed(() => String(route.params.id))
const playlist = computed(() => playlists.getPlaylist(playlistId.value))

const isRenaming = ref(false)
const renameValue = ref('')

const isFavorites = computed(() => playlistId.value === FAVORITES_PLAYLIST_ID)

const resolvedTracks = computed<LibraryTrack[]>(() => {
  if (!playlist.value) return []
  return playlist.value.tracks
    .map((snapshot) => library.getTrack(snapshot.trackId))
    .filter((t): t is LibraryTrack => Boolean(t))
})

const unavailableCount = computed(() => {
  if (!playlist.value) return 0
  return playlist.value.tracks.length - resolvedTracks.value.length
})

const hasTracks = computed(() => resolvedTracks.value.length > 0)

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

function playAll() {
  if (resolvedTracks.value.length === 0) return
  player.setQueue(resolvedTracks.value, 0)
}

function onSelectTrack(index: number) {
  player.setQueue(resolvedTracks.value, index)
}

function isCurrent(track: LibraryTrack): boolean {
  return currentTrack.value?.id === track.id
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <!-- Плейлист не найден -->
    <div
      v-if="!playlist"
      class="flex h-full flex-col items-center justify-center gap-3 text-sm text-zinc-500"
    >
      <p>Плейлист не найден</p>
      <RouterLink
        :to="{ name: 'playlists' }"
        class="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-emerald-400"
      >
        К плейлистам
      </RouterLink>
    </div>

    <template v-else>
      <!-- Шапка -->
      <div
        class="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3"
      >
        <div class="flex min-w-0 flex-1 items-center gap-2">
          <template v-if="isRenaming">
            <form class="flex flex-1 items-center gap-2" @submit.prevent="confirmRename">
              <input
                v-model="renameValue"
                type="text"
                autofocus
                class="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-emerald-500"
                @keydown.esc="cancelRename"
              />
              <button
                type="submit"
                class="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-medium text-zinc-900 transition hover:bg-emerald-400"
              >
                ОК
              </button>
              <button
                type="button"
                class="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-zinc-600"
                @click="cancelRename"
              >
                Отмена
              </button>
            </form>
          </template>

          <template v-else>
            <h1 class="truncate text-lg font-medium text-zinc-100">
              {{ playlist.name }}
            </h1>

            <button
              v-if="!isFavorites"
              type="button"
              class="rounded-md p-1 text-zinc-600 transition hover:bg-zinc-800 hover:text-zinc-300"
              aria-label="Переименовать"
              @click="startRename"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                class="h-3.5 w-3.5"
              >
                <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            </button>
          </template>
        </div>

        <div class="flex shrink-0 items-center gap-3">
          <span class="text-xs text-zinc-500">
            <template v-if="unavailableCount > 0">
              {{ resolvedTracks.length }} из {{ playlist.tracks.length }}
            </template>
            <template v-else> {{ resolvedTracks.length }} треков </template>
          </span>

          <button
            v-if="hasTracks"
            type="button"
            class="rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-400 transition hover:bg-emerald-500/25"
            @click="playAll"
          >
            Играть всё
          </button>

          <button
            v-if="!isFavorites"
            type="button"
            class="rounded-md p-1.5 text-zinc-600 transition hover:bg-zinc-800 hover:text-red-400"
            aria-label="Удалить плейлист"
            @click="deletePlaylist"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              class="h-4 w-4"
            >
              <path
                d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14zM10 11v6M14 11v6"
              />
            </svg>
          </button>
        </div>
      </div>

      <!-- Список -->
      <div class="flex-1 overflow-y-auto">
        <div
          v-if="playlist.tracks.length === 0"
          class="flex h-full items-center justify-center text-sm text-zinc-500"
        >
          Плейлист пуст
        </div>

        <div v-else class="flex flex-col gap-0.5 p-2">
          <template v-for="(snapshot, index) in playlist.tracks" :key="snapshot.trackId">
            <!-- Доступный трек -->
            <TrackListItem
              v-if="library.getTrack(snapshot.trackId)"
              :track="library.getTrack(snapshot.trackId)!"
              :index="index"
              :is-current="isCurrent(library.getTrack(snapshot.trackId)!)"
              :is-playing="isPlaying"
              @select="
                () => onSelectTrack(resolvedTracks.indexOf(library.getTrack(snapshot.trackId)!))
              "
            >
              <template #actions>
                <TrackActions
                  :track="library.getTrack(snapshot.trackId)!"
                  :playlist-id="playlist.id"
                />
              </template>
            </TrackListItem>

            <!-- Недоступный трек -->
            <div v-else class="group flex items-center gap-3 rounded-lg px-3 py-2 text-zinc-600">
              <div
                class="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-zinc-800/50"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  class="h-4 w-4"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </div>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm line-through">{{ snapshot.title }}</p>
                <p class="truncate text-xs">Источник недоступен</p>
              </div>
              <button
                type="button"
                class="rounded-md p-1.5 text-zinc-600 opacity-0 transition hover:bg-zinc-800 hover:text-red-400 group-hover:opacity-100"
                aria-label="Убрать из плейлиста"
                @click.stop="
                  () => playlists.removeTrackFromPlaylist(playlist!.id, snapshot.trackId)
                "
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  class="h-4 w-4"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </template>
        </div>
      </div>
    </template>
  </div>
</template>
