<!-- src/views/PlaylistsView.vue -->
<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { usePlaylistsStore } from '@/stores/playlists'
import { useLibraryStore } from '@/stores/library'
import { useUiSettingsStore } from '@/stores/uiSettings'
import { FAVORITES_PLAYLIST_ID } from '@/types/playlist'
import { pluralize } from '@/utils/pluralize'
import { toastService } from '@/services/ui/ToastService'
import { detectPlaylistFormat, parseM3U, parseJSON } from '@/utils/playlistParser'
import { findBestMatch } from '@/services/playlists/PlaylistMatcher'
import IconHeart from '@/components/icons/IconHeart.vue'
import IconPlaylist from '@/components/icons/IconPlaylist.vue'
import IconTrash from '@/components/icons/IconTrash.vue'
import type { Playlist, PlaylistExportTrack } from '@/types/playlist'

const router = useRouter()
const playlists = usePlaylistsStore()
const library = useLibraryStore()
const uiSettings = useUiSettingsStore()
const { sortedPlaylists } = storeToRefs(playlists)

const isCreating = ref(false)
const newName = ref('')
const fileInputRef = ref<HTMLInputElement | null>(null)

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

// --- Импорт ---------------------------------------------------------

function triggerImport() {
  fileInputRef.value?.click()
}

async function onFileSelected(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  try {
    const content = await file.text()
    const format = detectPlaylistFormat(content)

    if (format === 'json') {
      const parsed = parseJSON(content)
      if (!parsed) {
        toastService.error('Неверный формат JSON плейлиста')
        return
      }
      createPlaylistFromImport(parsed.name, parsed.tracks)
    } else if (format === 'm3u') {
      const parsed = parseM3U(content)
      const name = file.name.replace(/\.[^.]+$/, '')
      createPlaylistFromImport(name, parsed)
    } else {
      toastService.error('Не удалось распознать формат плейлиста')
    }
  } catch (err) {
    console.error('[import] failed', err)
    toastService.error('Ошибка чтения файла')
  } finally {
    target.value = ''
  }
}

function createPlaylistFromImport(name: string, tracks: PlaylistExportTrack[]) {
  if (tracks.length === 0) {
    toastService.error('Плейлист пуст')
    return
  }

  const playlistId = playlists.createPlaylist(name)
  const playlist = playlists.getPlaylist(playlistId)
  if (!playlist) return

  let matched = 0
  let fuzzyMatched = 0
  let unmatched = 0

  const allTracks = Object.values(library.tracks)
  const threshold = uiSettings.playlistMatchThreshold

  for (const t of tracks) {
    const exactMatch = allTracks.find(
      (libTrack) =>
        libTrack.title.toLowerCase().trim() === (t.title || '').toLowerCase().trim() &&
        libTrack.artist.toLowerCase().trim() === (t.artist || '').toLowerCase().trim()
    )

    if (exactMatch) {
      matched++
      playlist.tracks.push({
        trackId: exactMatch.id,
        pluginId: exactMatch.pluginId,
        title: exactMatch.title,
        artist: exactMatch.artist,
        album: exactMatch.album,
        remotePath: exactMatch.remotePath,
        addedAt: Date.now(),
      })
      continue
    }

    const bestMatch = findBestMatch(t, allTracks, threshold)

    if (bestMatch.track) {
      fuzzyMatched++
      playlist.tracks.push({
        trackId: bestMatch.track.id,
        pluginId: bestMatch.track.pluginId,
        title: bestMatch.track.title,
        artist: bestMatch.track.artist,
        album: bestMatch.track.album,
        remotePath: bestMatch.track.remotePath,
        addedAt: Date.now(),
      })
    } else {
      unmatched++
      playlist.tracks.push({
        trackId: `imported:${crypto.randomUUID()}`,
        pluginId: 'imported',
        title: t.title || 'Unknown Title',
        artist: t.artist || '',
        album: t.album,
        remotePath: t.path,
        addedAt: Date.now(),
      })
    }
  }

  playlist.updatedAt = Date.now()
  playlists.save()

  if (unmatched > 0 || fuzzyMatched > 0) {
    toastService.info(
      `Импортировано: ${tracks.length} (точно: ${matched}, примерное: ${fuzzyMatched}, не найдено: ${unmatched})`
    )
  } else {
    toastService.success(`Импортировано: ${tracks.length}`)
  }

  router.push({ name: 'playlist', params: { id: playlistId } })
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <!-- Шапка -->
    <div class="flex shrink-0 items-center justify-between gap-3 px-4 py-3">
      <div class="mx-auto flex w-full max-w-3xl items-center justify-between gap-3">
        <h1 class="text-lg font-medium text-fg">Плейлисты</h1>

        <div class="flex items-center gap-2">
          <button v-if="!isCreating" type="button"
            class="rounded-btn bg-card-bg px-3 py-1.5 text-xs text-fg transition hover:bg-hover-bg"
            @click="triggerImport">
            Импортировать
          </button>

          <button v-if="!isCreating" type="button"
            class="rounded-btn bg-accent px-3 py-1.5 text-xs font-medium text-bg transition hover:bg-accent-hover"
            @click="startCreate">
            Создать плейлист
          </button>
        </div>

        <input ref="fileInputRef" type="file" accept=".m3u,.json" class="hidden" @change="onFileSelected" />
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
      <div class="mx-auto w-full max-w-3xl">
        <div v-if="sortedPlaylists.length === 0"
          class="flex h-full items-center justify-center py-20 text-sm text-fg-muted">
          Плейлистов пока нет
        </div>

        <div v-else class="flex flex-col gap-0.5 -mx-2.5">
          <button v-for="playlist in sortedPlaylists" :key="playlist.id" type="button"
            class="group flex items-center gap-3 px-3 py-2 text-left text-fg transition hover:bg-hover-bg"
            @click="openPlaylist(playlist)">
            <!-- Иконка -->
            <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-btn bg-card-bg">
              <IconHeart v-if="playlist.id === FAVORITES_PLAYLIST_ID" :filled="true" class="h-5 w-5 text-active" />
              <IconPlaylist v-else class="h-5 w-5 text-fg-muted" />
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
              <IconTrash class="h-4 w-4" />
            </button>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
