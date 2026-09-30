<!-- src/components/library/TrackActions.vue -->
<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { usePlaylistsStore } from '@/stores/playlists'
import { FAVORITES_PLAYLIST_ID } from '@/types/playlist'
import type { Track } from '@/types/track'
import TrackReactionButtons from "../ui/TrackReactionButtons.vue";
import { trackMetadataService } from "@/services/metadata/TrackMetadataService.ts";
import { toastService } from "@/services/ui/ToastService.ts";
import { metadataPersistenceService, type OriginalMetadata } from "@/services/persistence/MetadataPersistenceService.ts";
import { useLibraryStore } from "@/stores/library.ts";
import { useUiSettingsStore } from "@/stores/uiSettings.ts";
import type { LibraryTrack } from "@/types/library.ts";

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

const isMenuOpen = ref(false)
const isSubmenuOpen = ref(false)
const isCreatingNew = ref(false)
const newPlaylistName = ref('')

const buttonRef = ref<HTMLElement | null>(null)
const menuRef = ref<HTMLElement | null>(null)
const menuPosition = ref({ top: 0, left: 0 })

const userPlaylists = computed(() =>
  playlists.sortedPlaylists.filter((p) => p.id !== FAVORITES_PLAYLIST_ID),
)

const library = useLibraryStore()
const uiSettings = useUiSettingsStore()
const isSearchingMetadata = ref(false)

async function findMetadata() {
  if (isSearchingMetadata.value) return
  isSearchingMetadata.value = true

  try {
    const artist = props.track.artist ?? ''
    const incoming = await trackMetadataService.fetch(
      artist,
      props.track.title,
      uiSettings.metadataThreshold,
    )

    if (!incoming) {
      toastService.info('Метаданные не найдены')
      closeMenu()
      return
    }

    const original: OriginalMetadata = {
      artist: props.track.artist ?? '',
      title: props.track.title,
      album: props.track.album ?? '',
      coverUrl: props.track.coverUrl,
      coverUrlWasBlob: props.track.coverUrl?.startsWith('blob:') ?? false,
    }

    metadataPersistenceService.setInMemory(props.track.id, {
      artist: incoming.artist,
      title: incoming.title,
      album: incoming.album,
      coverUrl: incoming.coverUrl,
      similarity: incoming.similarity,
      original,
    })
    await metadataPersistenceService.flush()

    if (!incoming.confident) {
      toastService.error(
        `Найдено другое: ${incoming.artist} — ${incoming.title} (${Math.round(incoming.similarity * 100)}%)`,
      )
      closeMenu()
      return
    }

    const patch: Partial<Pick<LibraryTrack, 'artist' | 'title' | 'album' | 'coverUrl'>> = {}
    const originalArtist = (props.track.artist ?? '').trim()

    if (!originalArtist || originalArtist === 'Yandex Disk') {
      if (incoming.artist) patch.artist = incoming.artist
    }
    if (incoming.title) patch.title = incoming.title
    if (incoming.album) patch.album = incoming.album
    if (!props.track.coverUrl && incoming.coverUrl) patch.coverUrl = incoming.coverUrl

    if (Object.keys(patch).length > 0) {
      library.updateTrackMetadata(props.track.id, patch)
      toastService.success('Метаданные обновлены')
    } else {
      toastService.info('Нечего обновлять')
    }
  } catch (err) {
    console.error('[track-actions] find metadata failed', err)
    toastService.error('Не удалось найти метаданные')
  } finally {
    isSearchingMetadata.value = false
    closeMenu()
  }
}

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
  // autofocus через ref
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
