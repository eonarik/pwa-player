<!-- src/components/library/TrackMetadataModal.vue -->
<script setup lang="ts">
import { ref, computed } from 'vue'
import { useLibraryStore } from '@/stores/library'
import { metadataPersistenceService } from '@/services/persistence/MetadataPersistenceService'
import { toastService } from '@/services/ui/ToastService'
import { modalService } from '@/services/ui/ModalService'
import AutocompleteInput from '@/components/ui/AutocompleteInput.vue'
import CoverPicker from '@/components/library/CoverPicker.vue'
import IconX from '@/components/icons/IconX.vue'
import type { LibraryTrack } from '@/types/library'
import { storeToRefs } from "pinia"

const props = defineProps<{
  track: LibraryTrack
}>()

const library = useLibraryStore()

const artist = ref(props.track.artist ?? '')
const title = ref(props.track.title ?? '')
const album = ref(props.track.album ?? '')
const coverUrl = ref(props.track.coverUrl)

const { tracks: allLibraryTracks } = storeToRefs(library)

const allArtists = computed(() => {
  return Array.from(new Set(
    Object.values(allLibraryTracks.value)
      .map((t) => t.artist?.trim())
      .filter((a): a is string => Boolean(a))
  )).sort((a, b) => a.localeCompare(b, 'ru'))
})

const allAlbums = computed(() => {
  return Array.from(new Set(
    Object.values(allLibraryTracks.value)
      .map((t) => t.album?.trim())
      .filter((a): a is string => Boolean(a))
  )).sort((a, b) => a.localeCompare(b, 'ru'))
})

function save() {
  const newArtist = artist.value.trim()
  const newTitle = title.value.trim()
  const newAlbum = album.value.trim()

  if (!newTitle) {
    toastService.error('Название трека не может быть пустым')
    return
  }

  library.updateTrackMetadata(props.track.id, {
    artist: newArtist,
    title: newTitle,
    album: newAlbum,
    coverUrl: coverUrl.value, // <-- Сохраняем обложку
  })

  metadataPersistenceService.setInMemory(props.track.id, {
    artist: newArtist || null,
    title: newTitle,
    album: newAlbum || null,
    coverUrl: coverUrl.value ?? null, // <-- Сохраняем в кэш
    similarity: 1,
    original: null,
  })
  void metadataPersistenceService.flush()

  toastService.success('Метаданные обновлены')
  modalService.confirm()
}

function cancel() {
  modalService.cancel()
}
</script>

<template>
  <div class="w-full max-w-md bg-bg-elevated p-5 shadow-xl">
    <div class="mb-4 flex items-center justify-between">
      <h2 class="text-lg font-medium text-fg">Редактировать метаданные</h2>
      <button type="button" class="rounded-btn p-1 text-fg-muted hover:bg-hover-bg hover:text-fg" aria-label="Закрыть"
        v-tooltip="'Закрыть'" @click="cancel">
        <IconX class="h-5 w-5" />
      </button>
    </div>

    <form class="flex flex-col gap-4" @submit.prevent="save">

      <!-- Обложка -->
      <div class="flex justify-center pb-2">
        <CoverPicker v-model="coverUrl" />
      </div>

      <div>
        <label class="mb-1 block text-xs text-fg-muted">Артист</label>
        <AutocompleteInput v-model="artist" :suggestions="allArtists" placeholder="Введите артиста..."
          id="track-artist" />
      </div>

      <div>
        <label class="mb-1 block text-xs text-fg-muted">Название</label>
        <input v-model="title" type="text"
          class="w-full rounded-btn bg-card-bg px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus:bg-hover-bg focus:outline-none"
          placeholder="Введите название..." />
      </div>

      <div>
        <label class="mb-1 block text-xs text-fg-muted">Альбом</label>
        <AutocompleteInput v-model="album" :suggestions="allAlbums" placeholder="Введите альбом..." id="track-album" />
      </div>

      <div class="mt-2 flex items-center justify-end gap-2">
        <button type="button" class="rounded-btn px-4 py-2 text-sm text-fg-muted hover:text-fg" @click="cancel">
          Отмена
        </button>
        <button type="submit"
          class="rounded-btn bg-accent px-4 py-2 text-sm font-medium text-bg hover:bg-accent-hover disabled:opacity-50"
          :disabled="!title.trim()">
          Сохранить
        </button>
      </div>
    </form>
  </div>
</template>
