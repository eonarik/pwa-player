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
import TrackReactionButtons from '../ui/TrackReactionButtons.vue'
import DropdownMenu from '@/components/ui/DropdownMenu.vue'
import TrackMetadataModal from './TrackMetadataModal.vue'
import IconDots from '@/components/icons/IconDots.vue'
import type { Track } from '@/types/track'
import type { LibraryTrack } from '@/types/library'
import { downloadOrchestrator } from '@/services/download/DownloadOrchestrator'
import { downloadSpaceService } from '@/services/download/DownloadSpaceService'
import { pluginCanDownload } from '@/plugins/registry'
import IconDownload from '../icons/IconDownload.vue'
import IconCloudCheck from '../icons/IconCloudCheck.vue'
import IconX from '../icons/IconX.vue'
import { modalService } from "@/services/ui/ModalService.ts"

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

// --- Логика кнопок метаданных ---
const isManuallyEdited = computed(() => {
  const entry = metadataPersistenceService.get(props.track.id)
  return entry?.similarity === 1
})

const canSearchMetadata = computed(() => {
  const t = props.track as LibraryTrack
  return Boolean(t.artist?.trim() && t.title?.trim())
})

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

async function openMetadataEdit(closeMenu: () => void): Promise<void> {
  closeMenu()
  try {
    await modalService.show({
      type: 'custom',
      component: TrackMetadataModal,
      props: {
        track: props.track,
      },
    })
  } catch (err) {
    console.error('[track-actions] metadata modal failed', err)
  }
}

async function findMetadata(close: () => void, isOverwrite = false): Promise<void> {
  if (isSearchingMetadata.value) return

  if (isOverwrite) {
    const confirmed = window.confirm(
      'Текущие метаданные будут перезаписаны результатами автопоиска. Продолжить?',
    )
    if (!confirmed) return
  }

  isSearchingMetadata.value = true

  const libraryTrack = library.getTrack(props.track.id)
  if (!libraryTrack) {
    toastService.error('Трек не найден в библиотеке')
    isSearchingMetadata.value = false
    closeMenu(close)
    return
  }

  // Если это ручная перезапись — сбрасываем флаг ручной правки,
  // чтобы metadataApplier.apply() смог применить новые теги.
  if (isOverwrite) {
    const entry = metadataPersistenceService.get(libraryTrack.id)
    if (entry) {
      // Удаляем или сбрасываем флаг (делаем similarity: null)
      metadataPersistenceService.setInMemory(libraryTrack.id, {
        artist: entry.artist,
        title: entry.title,
        album: entry.album,
        coverUrl: entry.coverUrl,
        similarity: null, // Больше не ручная правка
        original: entry.original,
      })
    }
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
        artist: null,
        title: null,
        album: null,
        coverUrl: null,
        similarity: null,
        original: null,
      })
      await metadataPersistenceService.flush()

      toastService.info('Метаданные не найдены')
      closeMenu(close)
      return
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

// --- Скачивание ---
const isDownloading = computed(() => downloadOrchestrator.isDownloading(props.track.id))

const downloadProgress = computed(() => {
  if (!isDownloading.value) return null
  const p = downloadOrchestrator.getProgress(props.track.id)
  if (!p || p.total <= 0) return null
  return Math.round((p.written / p.total) * 100)
})

const downloadOrigin = computed(() => (props.track as LibraryTrack).origin ?? 'remote')

const downloadLabel = computed(() => {
  if (isDownloading.value) {
    return downloadProgress.value !== null
      ? `Скачивание… ${downloadProgress.value}% · Отменить`
      : 'Отменить скачивание'
  }
  if (downloadOrigin.value === 'downloaded') return 'Удалить с устройства'
  if (downloadOrigin.value === 'only-local') return 'Удалить с устройства'
  return 'Скачать'
})

const canDownload = computed(() => pluginCanDownload(props.track.pluginId))

async function onDownload(close: () => void) {
  close()

  const track = props.track as LibraryTrack

  if (isDownloading.value) {
    downloadOrchestrator.cancel(track.id)
    return
  }

  if (downloadOrigin.value === 'remote') {
    try {
      if (!downloadSpaceService.hasSpace.value) {
        const ok = await downloadSpaceService.pickSpace()
        if (!ok) return
      }
      await downloadOrchestrator.downloadTrack(track)
    } catch (err) {
      console.error('[track-actions] download failed', err)
      toastService.error(err instanceof Error ? err.message : 'Не удалось скачать')
    }
    return
  }

  // downloaded / only-local
  if (downloadOrigin.value === 'only-local') {
    const ok = window.confirm('Удалить трек с устройства?')
    if (!ok) return
  }
  try {
    await downloadOrchestrator.removeDownloaded(track)
  } catch (err) {
    console.error('[track-actions] remove failed', err)
    toastService.error(err instanceof Error ? err.message : 'Не удалось удалить')
  }
}
</script>

<template>
  <div class="flex items-center gap-0.5">
    <TrackReactionButtons :track="track" size="sm" dislike-mode="toggle" />

    <DropdownMenu :width="256">
      <template #trigger="{ toggle, setTriggerRef }">
        <button :ref="setTriggerRef" type="button"
          class="rounded-btn p-1.5 text-fg-subtle transition hover:bg-hover-bg hover:text-fg" aria-label="Действия"
          v-tooltip="'Действия'" @click.stop="toggle">
          <IconDots class="h-4 w-4" />
        </button>
      </template>

      <template #default="{ close }">
        <!-- Добавить в плейлист -->
        <button type="button"
          class="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm text-fg transition hover:bg-hover-bg"
          @click="toggleSubmenu">
          <span>Добавить в плейлист</span>
          <span class="text-fg-muted">{{ isSubmenuOpen ? '▾' : '▸' }}</span>
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

        <!-- БЛОК МЕТАДАННЫХ -->
        <!-- 1. Основная кнопка: Редактировать (если правили руками ИЛИ нет тегов) -->
        <button v-if="isManuallyEdited || !canSearchMetadata" type="button"
          class="block w-full px-4 py-2.5 text-left text-sm text-fg transition hover:bg-hover-bg"
          @click="openMetadataEdit(close)">
          Редактировать метаданные
        </button>

        <!-- 2. Основная кнопка: Найти (если не правили руками И есть теги для поиска) -->
        <button v-else type="button"
          class="block w-full px-4 py-2.5 text-left text-sm text-fg transition hover:bg-hover-bg disabled:opacity-50"
          :disabled="isSearchingMetadata" @click="findMetadata(close, false)">
          {{ isSearchingMetadata ? 'Поиск…' : 'Найти метаданные' }}
        </button>

        <!-- 3. Второстепенная кнопка: Найти (если правили руками, но хотим перезаписать) -->
        <button v-if="isManuallyEdited" type="button"
          class="block w-full px-4 py-1.5 text-left text-xs text-fg-subtle transition hover:bg-hover-bg hover:text-fg-muted disabled:opacity-50"
          :disabled="isSearchingMetadata" @click="findMetadata(close, true)">
          <span v-if="isSearchingMetadata">Поиск…</span>
          <span v-else>Найти метаданные в интернете<br />(Приведет к сбросу ручных данных)</span>
        </button>

        <!-- 4. Второстепенная кнопка: Редактировать (если не правили руками, но нашли теги) -->
        <button v-else-if="canSearchMetadata" type="button"
          class="block w-full px-4 py-1.5 text-left text-xs text-fg-subtle transition hover:bg-hover-bg hover:text-fg-muted"
          @click="openMetadataEdit(close)">
          Редактировать вручную
        </button>

        <!-- Убрать из плейлиста -->
        <button v-if="playlistId" type="button"
          class="block w-full px-4 py-2.5 text-left text-sm text-red-400 transition hover:bg-hover-bg"
          @click="removeFromPlaylist(close)">
          Убрать из плейлиста
        </button>

        <!-- Убрать из очереди -->
        <button v-if="queueIndex !== undefined" type="button"
          class="block w-full px-4 py-2.5 text-left text-sm text-red-400 transition hover:bg-hover-bg"
          @click="removeFromQueue(close)">
          Убрать из очереди
        </button>

        <button v-if="canDownload" type="button"
          class="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition" :class="downloadOrigin === 'remote' && !isDownloading
            ? 'text-fg hover:bg-hover-bg'
            : 'text-fg-muted hover:bg-hover-bg hover:text-red-400'
            " @click="onDownload(close)">
          <IconDownload v-if="downloadOrigin === 'remote' && !isDownloading" class="h-4 w-4 shrink-0" />
          <IconCloudCheck v-else-if="downloadOrigin === 'downloaded'" class="h-4 w-4 shrink-0" />
          <IconX v-else-if="isDownloading" class="h-4 w-4 shrink-0" />
          <span class="truncate">{{ downloadLabel }}</span>
        </button>
      </template>
    </DropdownMenu>
  </div>
</template>
