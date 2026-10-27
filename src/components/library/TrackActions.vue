<!-- src/components/library/TrackActions.vue -->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useLibraryStore } from '@/stores/library'
import { usePlaylistsStore } from '@/stores/playlists'
import { useUiSettingsStore } from '@/stores/uiSettings'
import { trackMetadataService } from '@/services/metadata/TrackMetadataService'
import { metadataService } from '@/services/metadata/MetadataService'
import { toastService } from '@/services/ui/ToastService'
import { modalService } from '@/services/ui/ModalService'
import { downloadOrchestrator } from '@/services/download/DownloadOrchestrator'
import { downloadSpaceService } from '@/services/download/DownloadSpaceService'
import {
  pluginCanDownload,
  isLiveStream,
  isLinearContent,
  isStreamingPlugin
} from '@/plugins/registry'
import { isLocalTrack } from '@/services/library/selectors'
import TrackReactionButtons from '../ui/TrackReactionButtons.vue'
import DropdownMenu from '@/components/ui/DropdownMenu.vue'
import IconButton from '@/components/ui/IconButton.vue'
import Icon from '@/components/ui/Icon.vue'
import TrackMetadataModal from './TrackMetadataModal.vue'
import type { Track } from '@/types/track'
import type { LibraryTrack } from '@/types/library'
import PlaylistSubmenu from "./PlaylistSubmenu.vue"
import Divider from "../ui/Divider.vue"

const props = defineProps<{
  track: Track
  playlistId?: string
  queueIndex?: number
}>()

const emit = defineEmits<{
  (e: 'removed-from-playlist'): void
  (e: 'removed-from-queue'): void
}>()

const library = useLibraryStore()
const playlists = usePlaylistsStore()
const uiSettings = useUiSettingsStore()

const isSearchingMetadata = ref(false)

const isLinear = computed(() => isLinearContent(props.track.pluginId))
const isLive = computed(() => isLiveStream(props.track.pluginId))
const isStreaming = computed(() => isStreamingPlugin(props.track.pluginId))

const hasMetadataEntry = computed(() => metadataService.hasEntry(props.track.id))

// --- Метаданные -------------------------------------------------------

function openMetadataEditor(close: () => void): void {
  if (isStreaming.value) return // Запрещаем для стриминга
  const libraryTrack = library.getTrack(props.track.id) || (props.track as LibraryTrack)
  close()
  void modalService.show({
    title: 'Редактировать метаданные',
    type: 'custom',
    component: TrackMetadataModal,
    props: { track: libraryTrack },
    disableBackdropClose: true,
  })
}

async function removeMetadata(close: () => void): Promise<void> {
  if (isStreaming.value) return

  if (!confirm('Удалить метаданные и вернуть исходные значения?')) return

  const libraryTrack = library.getTrack(props.track.id)
  if (!libraryTrack) {
    toastService.error('Трек не найден в библиотеке')
    close()
    return
  }

  await metadataService.reset(props.track.id)
  toastService.success('Метаданные удалены')
  close()
}

async function findMetadata(close: () => void): Promise<void> {
  if (isStreaming.value) return
  if (isSearchingMetadata.value) return

  const libraryTrack = library.getTrack(props.track.id)
  if (!libraryTrack) {
    toastService.error('Трек не найден в библиотеке')
    close()
    return
  }

  if (libraryTrack.metaSource === 'file' || libraryTrack.metaSource === 'manual') {
    const confirmed = await modalService.show({
      title: 'Перезаписать метаданные?',
      message: 'У трека уже есть надежные метаданные. Поиск в интернете может заменить их ненадежными данными.',
      type: 'confirm',
      confirmLabel: 'Продолжить',
      cancelLabel: 'Отмена',
    })

    if (!confirmed) {
      close()
      return
    }
  }

  isSearchingMetadata.value = true
  close()

  try {
    const result = await trackMetadataService.fetch(
      libraryTrack.artist ?? '',
      libraryTrack.title,
      uiSettings.metadataThreshold,
    )

    if (result.status === 'aborted') return
    if (result.status === 'error') {
      toastService.error(`Ошибка поиска: ${result.message}`)
      return
    }

    if (result.status === 'not-found') {
      useLibraryStore().updateTrackMetadata(libraryTrack.id, { metaSource: 'unknown' })
      toastService.info('Метаданные не найдены')
      return
    }

    const applyResult = metadataService.applyRemote(libraryTrack.id, result.data)

    if (applyResult.status === 'applied') {
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

const libraryTrack = computed<LibraryTrack | null>(() => {
  const lib = library.getTrack(props.track.id)
  if (lib) return lib

  if (isStreaming.value) {
    return {
      ...props.track,
      folderId: 'virtual',
      isVirtual: true,
      handle: undefined,
      fileLocation: 'remote-only',
    } as LibraryTrack
  }

  return null
})

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
  if (isStreaming.value) return false
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
    const success = await downloadOrchestrator.downloadTrack(t)
    if (!success) {
      toastService.error('Не удалось скачать трек (ошибка сети или сервера)')
    }
  } catch (err) {
    console.error('[track-actions] download failed', err)
    toastService.error(err instanceof Error ? err.message : 'Не удалось скачать')
  }
}

// --- Удаление --------------------------------------------------------

function removeFromPlaylist(close: () => void): void {
  if (!props.playlistId) return
  playlists.removeTrackFromPlaylist(props.playlistId, props.track.id)
  emit('removed-from-playlist')
  close()
}

function removeFromQueue(close: () => void): void {
  if (props.queueIndex === undefined) return
  emit('removed-from-queue')
  close()
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
          <PlaylistSubmenu :tracks="[track]" in-dropdown @close="close" />
          <Divider />
        </template>

        <template v-if="!isLive && !isLinear && !isStreaming">
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
