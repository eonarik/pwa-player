<!-- src/views/PlaylistsView.vue -->
<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { usePlaylistsStore } from '@/stores/playlists'
import { usePlayerStore } from '@/stores/player'
import { FAVORITES_PLAYLIST_ID } from '@/types/playlist'
import { pluralize } from '@/utils/pluralize'
import type { Playlist } from '@/types/playlist'

const router = useRouter()
const playlists = usePlaylistsStore()
const player = usePlayerStore()
const { sortedPlaylists } = storeToRefs(playlists)

const isCreating = ref(false)
const newName = ref('')

function openPlaylist(playlist: Playlist) {
  router.push({ name: 'playlist', params: { id: playlist.id } })
}

function startCreate() {
  isCreating.value = true
  newName.value = ''
}

function cancelCreate() {
  isCreating.value = false
  newName.value = ''
}

function confirmCreate() {
  const name = newName.value.trim()
  if (!name) return
  const id = playlists.createPlaylist(name)
  isCreating.value = false
  newName.value = ''
  router.push({ name: 'playlist', params: { id } })
}

function deletePlaylist(playlist: Playlist) {
  if (playlist.id === FAVORITES_PLAYLIST_ID) return
  const confirmed = window.confirm(`Удалить плейлист «${playlist.name}»?`)
  if (!confirmed) return
  playlists.deletePlaylist(playlist.id)
}

function formatDate(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <!-- Шапка -->
    <div class="flex shrink-0 items-center justify-between gap-3 px-4 py-3">
      <div class="mx-auto flex w-full max-w-3xl items-center justify-between gap-3">
        <h1 class="text-lg font-medium text-fg">Плейлисты</h1>

        <button v-if="!isCreating" type="button"
          class="rounded-btn bg-accent px-3 py-1.5 text-xs font-medium text-bg transition hover:bg-accent-hover"
          @click="startCreate">
          Создать плейлист
        </button>
      </div>
    </div>

    <!-- Форма создания -->
    <div v-if="isCreating" class="shrink-0 px-4 py-3">
      <div class="mx-auto w-full max-w-3xl">
        <form class="flex items-center gap-2" @submit.prevent="confirmCreate">
          <input v-model="newName" type="text" placeholder="Название плейлиста" autofocus
            class="flex-1 rounded-btn bg-card-bg px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus:bg-hover-bg focus:outline-none" />
          <button type="submit"
            class="rounded-btn bg-accent px-3 py-2 text-xs font-medium text-bg transition hover:bg-accent-hover disabled:opacity-50"
            :disabled="!newName.trim()">
            Создать
          </button>
          <button type="button" class="rounded-btn bg-card-bg px-3 py-2 text-xs text-fg transition hover:bg-hover-bg"
            @click="cancelCreate">
            Отмена
          </button>
        </form>
      </div>
    </div>

    <!-- Список -->
    <div class="flex-1 overflow-y-auto">
      <div class="mx-auto w-full max-w-3xl p-2">
        <div v-if="sortedPlaylists.length === 0"
          class="flex h-full items-center justify-center py-20 text-sm text-fg-muted">
          Плейлистов пока нет
        </div>

        <div v-else class="flex flex-col gap-0.5">
          <button v-for="playlist in sortedPlaylists" :key="playlist.id" type="button"
            class="group flex items-center gap-3 rounded-card px-3 py-2 text-left text-fg transition hover:bg-hover-bg"
            @click="openPlaylist(playlist)">
            <!-- Иконка -->
            <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-btn bg-card-bg">
              <svg v-if="playlist.id === FAVORITES_PLAYLIST_ID" viewBox="0 0 24 24" fill="currentColor"
                class="h-5 w-5 text-active">
                <path d="M12 21s-7-4.35-7-10a5 5 0 019-3 5 5 0 019 3c0 5.65-7 10-7 10z" />
              </svg>
              <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"
                class="h-5 w-5 text-fg-muted">
                <path d="M9 18V5l12-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zm12-2a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>

            <!-- Название и метаданные -->
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium">{{ playlist.name }}</p>
              <p class="truncate text-xs text-fg-muted">
                {{ pluralize(playlist.tracks.length, ['трек', 'трека', 'треков']) }}
                <span v-if="playlist.id !== FAVORITES_PLAYLIST_ID">
                  · {{ formatDate(playlist.updatedAt) }}
                </span>
              </p>
            </div>

            <!-- Удалить -->
            <button v-if="playlist.id !== FAVORITES_PLAYLIST_ID" type="button"
              class="rounded-btn p-1.5 text-fg-subtle opacity-0 transition hover:bg-hover-bg hover:text-red-400 group-hover:opacity-100"
              aria-label="Удалить" @click.stop="deletePlaylist(playlist)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-4 w-4">
                <path
                  d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14zM10 11v6M14 11v6" />
              </svg>
            </button>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
