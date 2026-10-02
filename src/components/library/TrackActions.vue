<!-- src/components/library/TrackActions.vue -->
<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { usePlaylistsStore } from '@/stores/playlists'
import { useLibraryStore } from '@/stores/library'
import { useUiSettingsStore } from '@/stores/uiSettings'
import { FAVORITES_PLAYLIST_ID } from '@/types/playlist'
import { trackMetadataService } from '@/services/metadata/TrackMetadataService'
import { metadataApplier } from '@/services/metadata/MetadataApplier'
import { toastService } from '@/services/ui/ToastService'
import TrackReactionButtons from '../ui/TrackReactionButtons.vue'
import type { Track } from '@/types/track'
import type { LibraryTrack } from '@/types/library'
import { metadataPersistenceService } from "@/services/persistence/MetadataPersistenceService.ts"

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

const isMenuOpen = ref(false)
const isSubmenuOpen = ref(false)
const isCreatingNew = ref(false)
const newPlaylistName = ref('')
const isSearchingMetadata = ref(false)

const buttonRef = ref<HTMLElement | null>(null)
const menuRef = ref<HTMLElement | null>(null)
const menuPosition = ref({ top: 0, left: 0 })

const userPlaylists = computed(() =>
  playlists.sortedPlaylists.filter((p) => p.id !== FAVORITES_PLAYLIST_ID),
)

function openMenu() {
  if (!buttonRef.value) return
  const rect = buttonRef.value.getBoundingClientRect()
  const MENU_WIDTH = 256
  const menuLeft = Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8)
  menuPosition.value = {
    top: rect.bottom + 4,
    left: Math.max(8, menuLeft),
  }
  isMenuOpen.value = true
}

function closeMenu() {
  isMenuOpen.value = false
  isSubmenuOpen.value = false
  isCreatingNew.value = false
  newPlaylistName.value = ''
}

function toggleSubmenu() {
  isSubmenuOpen.value = !isSubmenuOpen.value
}

function addToPlaylist(playlistId: string) {
  playlists.addTrackToPlaylist(playlistId, props.track)
  closeMenu()
}

async function startCreate() {
  isCreatingNew.value = true
  newPlaylistName.value = ''
  await nextTick()
  const input = menuRef.value?.querySelector<HTMLInputElement>('input')
  input?.focus()
}

function confirmCreate() {
  const name = newPlaylistName.value.trim()
  if (!name) return
  const id = playlists.createPlaylist(name)
  playlists.addTrackToPlaylist(id, props.track)
  closeMenu()
}

function removeFromPlaylist() {
  if (!props.playlistId) return
  playlists.removeTrackFromPlaylist(props.playlistId, props.track.id)
  emit('removed-from-playlist')
  closeMenu()
}

function removeFromQueue() {
  if (props.queueIndex === undefined) return
  emit('removed-from-queue')
  closeMenu()
}

async function findMetadata() {
  if (isSearchingMetadata.value) return
  isSearchingMetadata.value = true

  const libraryTrack = library.getTrack(props.track.id)
  if (!libraryTrack) {
    toastService.error('Трек не найден в библиотеке')
    isSearchingMetadata.value = false
    closeMenu()
    return
  }

  try {
    const result = await trackMetadataService.fetch(
      libraryTrack.artist ?? '',
      libraryTrack.title,
      uiSettings.metadataThreshold,
    )

    if (result.status === 'aborted') {
      closeMenu()
      return
    }

    if (result.status === 'error') {
      toastService.error(`Ошибка поиска: ${result.message}`)
      closeMenu()
      return
    }

    if (result.status === 'not-found') {
      // Кэшируем «не найдено», чтобы не искать повторно
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
      closeMenu()
      return
    }

    const applyResult = metadataApplier.apply(libraryTrack, result.data)

    if (applyResult.status === 'applied') {
      await metadataPersistenceService.flush()
      toastService.success('Метаданные обновлены')
    } else if (applyResult.status === 'issue') {
      // Confident=false — не применяем, показываем тост
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
    closeMenu()
  }
}

function onClickOutside(e: MouseEvent) {
  if (
    menuRef.value &&
    !menuRef.value.contains(e.target as Node) &&
    buttonRef.value &&
    !buttonRef.value.contains(e.target as Node)
  ) {
    closeMenu()
  }
}

onMounted(() => {
  document.addEventListener('click', onClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', onClickOutside)
})
</script>

<template>
  <div class="flex items-center gap-0.5">
    <TrackReactionButtons :track="track" size="sm" dislike-mode="toggle" />

    <!-- Кнопка меню -->
    <button ref="buttonRef" type="button"
      class="rounded-btn p-1.5 text-fg-subtle transition hover:bg-hover-bg hover:text-fg" aria-label="Действия"
      @click.stop="isMenuOpen ? closeMenu() : openMenu()">
      <svg viewBox="0 0 24 24" fill="currentColor" class="h-4 w-4">
        <circle cx="5" cy="12" r="1.5" />
        <circle cx="12" cy="12" r="1.5" />
        <circle cx="19" cy="12" r="1.5" />
      </svg>
    </button>

    <!-- Меню -->
    <Teleport to="body">
      <div v-if="isMenuOpen" ref="menuRef" class="fixed z-[100] w-64 overflow-hidden bg-bg-elevated shadow-lg"
        :style="{ top: `${menuPosition.top}px`, left: `${menuPosition.left}px` }" @click.stop>
        <button type="button"
          class="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm text-fg transition hover:bg-hover-bg"
          @click="toggleSubmenu">
          <span>Добавить в плейлист</span>
          <span class="text-fg-muted">{{ isSubmenuOpen ? '▾' : '▸' }}</span>
        </button>

        <div v-if="isSubmenuOpen">
          <button v-for="p in userPlaylists" :key="p.id" type="button"
            class="block w-full truncate px-6 py-2 text-left text-sm text-fg-muted transition hover:bg-hover-bg hover:text-fg"
            @click="addToPlaylist(p.id)">
            {{ p.name }}
          </button>

          <button v-if="!isCreatingNew" type="button"
            class="block w-full px-6 py-2 text-left text-sm text-active transition hover:bg-hover-bg"
            @click="startCreate">
            + Создать новый
          </button>

          <form v-else class="px-4 py-2" @submit.prevent="confirmCreate">
            <input v-model="newPlaylistName" type="text" placeholder="Название плейлиста"
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

        <button type="button"
          class="block w-full px-4 py-2.5 text-left text-sm text-fg transition hover:bg-hover-bg disabled:opacity-50"
          :disabled="isSearchingMetadata" @click="findMetadata">
          {{ isSearchingMetadata ? 'Поиск…' : 'Найти метаданные' }}
        </button>

        <template v-if="playlistId">
          <button type="button"
            class="block w-full px-4 py-2.5 text-left text-sm text-red-400 transition hover:bg-hover-bg"
            @click="removeFromPlaylist">
            Убрать из плейлиста
          </button>
        </template>

        <template v-if="queueIndex !== undefined">
          <button type="button"
            class="block w-full px-4 py-2.5 text-left text-sm text-red-400 transition hover:bg-hover-bg"
            @click="removeFromQueue">
            Убрать из очереди
          </button>
        </template>
      </div>
    </Teleport>
  </div>
</template>
