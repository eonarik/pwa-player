<!-- src/components/library/TrackActions.vue -->
<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { usePlaylistsStore } from '@/stores/playlists'
import { useLibraryStore } from '@/stores/library'
import { useUiSettingsStore } from '@/stores/uiSettings'
import { FAVORITES_PLAYLIST_ID } from '@/types/playlist'
import { trackMetadataService } from '@/services/metadata/TrackMetadataService'
import { metadataApplier } from '@/services/metadata/MetadataApplier'
import { metadataPersistenceService } from '@/services/persistence/MetadataPersistenceService'
import { toastService } from '@/services/ui/ToastService'
import { modalService } from '@/services/ui/ModalService'
import { downloadOrchestrator } from '@/services/download/DownloadOrchestrator'
import { downloadSpaceService } from '@/services/download/DownloadSpaceService'
import { pluginCanDownload, isLiveStream, isLinearContent } from '@/plugins/registry'
import { isLocalTrack } from '@/services/library/selectors'
import TrackReactionButtons from '../ui/TrackReactionButtons.vue'
import DropdownMenu from '@/components/ui/DropdownMenu.vue'
import IconButton from '@/components/ui/IconButton.vue'
import Icon from '@/components/ui/Icon.vue'
import TrackMetadataModal from './TrackMetadataModal.vue'
import type { Track } from '@/types/track'
import type { LibraryTrack } from '@/types/library'

const props = defineProps<{
  track: Track
  playlistId?: string
  queueIndex?: number
}>()

const emit = defineEmits<{
  (e: 'removed-from-playlist'): void
  (e: 'removed-from-queue'): void
}>()

const playlists = usePlaylistsStore()
const library = useLibraryStore()
const uiSettings = useUiSettingsStore()

const isSubmenuOpen = ref(false)
const isCreatingNew = ref(false)
const newPlaylistName = ref('')
const isSearchingMetadata = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)

const userPlaylists = computed(() =>
  playlists.sortedPlaylists.filter((p) => p.id !== FAVORITES_PLAYLIST_ID),
)

const isLinear = computed(() => isLinearContent(props.track.pluginId))
const isLive = computed(() => isLiveStream(props.track.pluginId))

const hasMetadataEntry = computed(() => {
  const entry = metadataPersistenceService.get(props.track.id)
  return entry !== undefined && entry.artist !== null
})

// --- Плейлисты --------------------------------------------------------

function closeMenu(close: () => void): void {
  isSubmenuOpen.value = false
  isCreatingNew.value = false
  newPlaylistName.value = ''
  close()
}

function toggleSubmenu(): void {
  isSubmenuOpen.value = !isSubmenuOpen.value
}

function addToPlaylist(playlistId: string, close: () => void): void {
  playlists.addTrackToPlaylist(playlistId, props.track)
  closeMenu(close)
}

async function startCreate(): Promise<void> {
  isCreatingNew.value = true
  newPlaylistName.value = ''
  await nextTick()
  inputRef.value?.focus()
}

function confirmCreate(close: () => void): void {
  const name = newPlaylistName.value.trim()
  if (!name) return
  const id = playlists.createPlaylist(name)
  playlists.addTrackToPlaylist(id, props.track)
  closeMenu(close)
}

function removeFromPlaylist(close: () => void): void {
  if (!props.playlistId) return
  playlists.removeTrackFromPlaylist(props.playlistId, props.track.id)
  emit('removed-from-playlist')
  closeMenu(close)
}

function removeFromQueue(close: () => void): void {
  if (props.queueIndex === undefined) return
  emit('removed-from-queue')
  closeMenu(close)
}

// --- Метаданные -------------------------------------------------------

function openMetadataEditor(close: () => void): void {
  const libraryTrack = library.getTrack(props.track.id) || (props.track as LibraryTrack)
  closeMenu(close)
  void modalService.show({
    title: 'Редактировать метаданные',
    type: 'custom',
    component: TrackMetadataModal,
    props: { track: libraryTrack },
    disableBackdropClose: true,
  })
}

async function removeMetadata(close: () => void): Promise<void> {
  if (!confirm('Удалить метаданные и вернуть исходные значения?')) return

  const libraryTrack = library.getTrack(props.track.id)
  if (!libraryTrack) {
    toastService.error('Трек не найден в библиотеке')
    closeMenu(close)
    return
  }

  const entry = metadataPersistenceService.get(props.track.id)
  if (entry?.original) {
    library.updateTrackMetadata(props.track.id, {
      artist: entry.original.artist,
      title: entry.original.title,
      album: entry.original.album,
      coverUrl: entry.original.coverUrl,
    })
  }

  await metadataPersistenceService.resetForTracks([props.track.id])

  toastService.success('Метаданные удалены')
  closeMenu(close)
}

async function findMetadata(close: () => void): Promise<void> {
  if (isSearchingMetadata.value) return
  isSearchingMetadata.value = true

  const libraryTrack = library.getTrack(props.track.id)
  if (!libraryTrack) {
    toastService.error('Трек не найден в библиотеке')
    isSearchingMetadata.value = false
    closeMenu(close)
    return
  }

  try {
    const result = await trackMetadataService.fetch(
      libraryTrack.artist ?? '',
      libraryTrack.title,
      uiSettings.metadataThreshold,
    )

    if (result.status === 'aborted') {
      closeMenu(close)
      return
    }

    if (result.status === 'error') {
      toastService.error(`Ошибка поиска: ${result.message}`)
      closeMenu(close)
      return
    }

    if (result.status === 'not-found') {
      metadataPersistenceService.setInMemory(libraryTrack.id, {
        artist: null, title: null, album: null, coverUrl: null, similarity: null, original: null,
      })
      await metadataPersistenceService.flush()
      toastService.info('Метаданные не найдены')
      closeMenu(close)
      return
    }

    const entry = metadataPersistenceService.get(libraryTrack.id)
    if (entry && entry.similarity === 1) {
      metadataPersistenceService.setInMemory(libraryTrack.id, {
        artist: entry.artist,
        title: entry.title,
        album: entry.album,
        coverUrl: entry.coverUrl,
        similarity: null,
        original: entry.original,
      })
    }

    const applyResult = metadataApplier.apply(libraryTrack, result.data)

    if (applyResult.status === 'applied') {
      await metadataPersistenceService.flush()
      toastService.success('Метаданные обновлены')
    } else if (applyResult.status === 'issue') {
      const incoming = result.data
      toastService.error(
        `Найдено другое: ${incoming.artist} — ${incoming.title} (${Math.round(incoming.similarity * 100)}%)`,
      )
    }
  } catch (err) {
    console.error('[track-actions] find metadata failed', err)
    toastService.error('Не удалось найти метаданные')
  } finally {
    isSearchingMetadata.value = false
    closeMenu(close)
  }
}

// --- Скачивание -------------------------------------------------------

const isDownloading = computed(() => downloadOrchestrator.isDownloading(props.track.id))
const downloadProgress = computed(() => {
  if (!isDownloading.value) return null
  const p = downloadOrchestrator.getProgress(props.track.id)
  if (!p || p.total <= 0) return null
  return Math.round((p.written / p.total) * 100)
})

const libraryTrack = computed<LibraryTrack | null>(() => library.getTrack(props.track.id))

const downloadLabel = computed(() => {
  if (isDownloading.value) {
    return downloadProgress.value !== null
      ? `Скачивание… ${downloadProgress.value}% · Отменить`
      : 'Отменить скачивание'
  }
  const t = libraryTrack.value
  if (!t) return 'Скачать'
  return isLocalTrack(t) ? 'Удалить с устройства' : 'Скачать'
})

const canDownload = computed(() => {
  if (isLive.value) return false
  if (!pluginCanDownload(props.track.pluginId)) return false
  return true
})

async function onDownload(close: () => void) {
  close()
  const t = libraryTrack.value
  if (!t) return

  if (isDownloading.value) {
    downloadOrchestrator.cancel(t.id)
    return
  }

  if (isLocalTrack(t)) {
    try {
      await downloadOrchestrator.removeDownloaded(t)
    } catch (err) {
      console.error('[track-actions] remove failed', err)
      toastService.error(err instanceof Error ? err.message : 'Не удалось удалить')
    }
    return
  }

  try {
    if (!downloadSpaceService.hasSpace.value) {
      const ok = await downloadSpaceService.pickSpace()
      if (!ok) return
    }
    await downloadOrchestrator.downloadTrack(t)
  } catch (err) {
    console.error('[track-actions] download failed', err)
    toastService.error(err instanceof Error ? err.message : 'Не удалось скачать')
  }
}
</script>

<template>
  <div class="flex items-center gap-0.5">
    <TrackReactionButtons v-if="!isLive && !isLinear" :track="track" size="sm" dislike-mode="toggle" />

    <DropdownMenu :width="256">
      <template #trigger="{ toggle, setTriggerRef }">
        <div :ref="setTriggerRef">
          <IconButton icon="dots" label="Действия" @click="toggle" />
        </div>
      </template>

      <template #default="{ close }">
        <template v-if="!isLive">
          <button type="button"
            class="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm text-fg transition hover:bg-hover-bg"
            @click="toggleSubmenu">
            <span>Добавить в плейлист</span>
            <Icon :name="isSubmenuOpen ? 'chevron-down' : 'chevron-right'" w="w-3.5" h="h-3.5" class="text-fg-muted" />
          </button>

          <div v-if="isSubmenuOpen">
            <button v-for="p in userPlaylists" :key="p.id" type="button"
              class="block w-full truncate px-6 py-2 text-left text-sm text-fg-muted transition hover:bg-hover-bg hover:text-fg"
              @click="addToPlaylist(p.id, close)">
              {{ p.name }}
            </button>
            <button v-if="!isCreatingNew" type="button"
              class="block w-full px-6 py-2 text-left text-sm text-active transition hover:bg-hover-bg"
              @click="startCreate">
              + Создать новый
            </button>
            <form v-else class="px-4 py-2" @submit.prevent="confirmCreate(close)">
              <input ref="inputRef" v-model="newPlaylistName" type="text" placeholder="Название плейлиста"
                class="w-full rounded-btn bg-card-bg px-2 py-1.5 text-sm text-fg placeholder:text-fg-subtle focus:bg-hover-bg focus:outline-none"
                @keydown.esc="isCreatingNew = false" />
              <div class="mt-2 flex items-center justify-end gap-2">
                <button type="button" class="rounded-btn px-2 py-1 text-xs text-fg-muted transition hover:text-fg"
                  @click="isCreatingNew = false">
                  Отмена
                </button>
                <button type="submit"
                  class="rounded-btn bg-accent px-3 py-1 text-xs font-medium text-bg transition hover:bg-accent-hover disabled:opacity-50"
                  :disabled="!newPlaylistName.trim()">
                  Создать
                </button>
              </div>
            </form>
          </div>
        </template>

        <template v-if="!isLive && !isLinear">
          <button type="button"
            class="block w-full px-4 py-1.5 text-left text-sm text-fg transition hover:bg-hover-bg hover:text-fg-muted disabled:opacity-50"
            :disabled="isSearchingMetadata" @click="findMetadata(close)">
            <span v-if="isSearchingMetadata">Поиск…</span>
            <span v-else>Найти в интернете<br /><span class="text-fg-subtle text-xs">сбросит ручные правки</span></span>
          </button>

          <template v-if="hasMetadataEntry">
            <button type="button"
              class="block w-full px-4 py-2.5 text-left text-sm text-fg transition hover:bg-hover-bg"
              @click="openMetadataEditor(close)">
              Редактировать метаданные
            </button>
            <button type="button"
              class="block w-full px-4 py-1.5 text-left text-xs text-red-400 transition hover:bg-hover-bg"
              @click="removeMetadata(close)">
              Удалить метаданные
            </button>
          </template>

          <template v-else>
            <button type="button"
              class="block w-full px-4 py-2.5 text-left text-sm text-fg transition hover:bg-hover-bg"
              @click="openMetadataEditor(close)">
              Редактировать вручную
            </button>
          </template>
        </template>

        <button v-if="playlistId" type="button"
          class="block w-full px-4 py-2.5 text-left text-sm text-red-400 transition hover:bg-hover-bg"
          @click="removeFromPlaylist(close)">
          Убрать из плейлиста
        </button>

        <button v-if="queueIndex !== undefined" type="button"
          class="block w-full px-4 py-2.5 text-left text-sm text-red-400 transition hover:bg-hover-bg"
          @click="removeFromQueue(close)">
          Убрать из очереди
        </button>

        <button v-if="canDownload" type="button"
          class="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition" :class="libraryTrack && !isLocalTrack(libraryTrack) && !isDownloading
            ? 'text-fg hover:bg-hover-bg'
            : 'text-fg-muted hover:bg-hover-bg hover:text-red-400'
            " @click="onDownload(close)">
          <Icon v-if="libraryTrack && !isLocalTrack(libraryTrack) && !isDownloading" name="download" w="w-4" h="h-4" />
          <Icon v-else-if="libraryTrack && isLocalTrack(libraryTrack)" name="cloud-check" w="w-4" h="h-4" />
          <Icon v-else-if="isDownloading" name="x" w="w-4" h="h-4" />
          <span class="truncate">{{ downloadLabel }}</span>
        </button>
      </template>
    </DropdownMenu>
  </div>
</template>
