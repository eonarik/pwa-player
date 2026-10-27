<!-- src/views/PlaylistsView.vue -->
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
import { createTrackSnapshot } from '@/utils/trackSnapshot' // <-- импорт
import PageHeader from '@/components/ui/PageHeader.vue'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Icon from '@/components/ui/Icon.vue'
import IconHeart from '@/components/icons/IconHeart.vue'
import ListContainer from '@/components/ui/ListContainer.vue'
import type { Playlist, PlaylistExportTrack } from '@/types/playlist'
import type { Track } from "@/types"

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
        ...createTrackSnapshot(exactMatch),
        addedAt: Date.now(),
      })
      continue
    }

    const bestMatch = findBestMatch(t, allTracks, threshold)

    if (bestMatch.track) {
      fuzzyMatched++
      playlist.tracks.push({
        ...createTrackSnapshot(bestMatch.track),
        addedAt: Date.now(),
      })
    } else {
      unmatched++
      // Создаем "пустой" трек для неизвестного
      const fallbackTrack: Track = {
        id: `imported:${crypto.randomUUID()}`,
        pluginId: 'imported',
        title: t.title || 'Unknown Title',
        artist: t.artist || '',
        album: t.album || '',
        duration: t.duration || 0,
        filename: '',
        source: '',
      }
      playlist.tracks.push({
        ...createTrackSnapshot(fallbackTrack),
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
    <PageHeader title="Плейлисты">
      <Button v-if="!isCreating" variant="secondary" size="sm" @click="triggerImport">
        Импортировать
      </Button>
      <Button v-if="!isCreating" variant="primary" size="sm" @click="startCreate">
        Создать плейлист
      </Button>
      <input ref="fileInputRef" type="file" accept=".m3u,.json" class="hidden" @change="onFileSelected" />
    </PageHeader>

    <!-- Форма создания -->
    <div v-if="isCreating" class="shrink-0 px-4 py-3">
      <div class="mx-auto w-full max-w-3xl">
        <form class="flex items-center gap-2" @submit.prevent="confirmCreate">
          <Input v-model="newName" placeholder="Название плейлиста" autofocus class="flex-1" />
          <Button type="submit" variant="primary" size="sm" :disabled="!newName.trim()">Создать</Button>
          <Button variant="secondary" size="sm" @click="cancelCreate">Отмена</Button>
        </form>
      </div>
    </div>

    <!-- Список -->
    <div class="flex-1 overflow-y-auto">
      <div class="mx-auto w-full max-w-3xl p-2">
        <EmptyState v-if="sortedPlaylists.length === 0" title="Плейлистов пока нет">
          <template #icon>
            <Icon name="playlist" w="w-10" h="h-10" />
          </template>
        </EmptyState>

        <ListContainer v-else max-width="lg">
          <button v-for="playlist in sortedPlaylists" :key="playlist.id" type="button"
            class="group flex items-center gap-3 px-3 py-2 text-left text-fg transition hover:bg-hover-bg"
            @click="openPlaylist(playlist)">
            <!-- Иконка -->
            <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-btn bg-card-bg">
              <IconHeart v-if="playlist.id === FAVORITES_PLAYLIST_ID" :filled="true" class="icon h-5 w-5 text-active" />
              <Icon v-else name="playlist" w="w-5" h="h-5" class="text-fg-muted" />
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
            <div v-if="playlist.id !== FAVORITES_PLAYLIST_ID"
              class="rounded-btn p-1.5 text-fg-subtle opacity-0 transition hover:bg-hover-bg hover:text-red-400 group-hover:opacity-100"
              aria-label="Удалить" @click.stop="deletePlaylist(playlist)">
              <Icon name="trash" w="w-4" h="h-4" />
            </div>
          </button>
        </ListContainer>
      </div>
    </div>
  </div>
</template>
