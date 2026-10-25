<!-- src/components/library/TrackMetadataModal.vue -->
<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useLibraryStore } from '@/stores/library'
import { metadataService } from '@/services/metadata/MetadataService'
import { trackMetadataService, type MetadataCandidate } from '@/services/metadata/TrackMetadataService'
import { toastService } from '@/services/ui/ToastService'
import { modalService } from '@/services/ui/ModalService'
import AutocompleteInput from '@/components/ui/AutocompleteInput.vue'
import CoverPicker from '@/components/library/CoverPicker.vue'
import CoverImage from '@/components/ui/CoverImage.vue'
import ModalLayout from '@/components/ui/ModalLayout.vue'
import FormField from '@/components/ui/FormField.vue'
import Input from '@/components/ui/Input.vue'
import Button from '@/components/ui/Button.vue'
import Icon from '@/components/ui/Icon.vue'
import Spinner from '@/components/ui/Spinner.vue'
import type { LibraryTrack } from '@/types/library'

const props = defineProps<{
  track: LibraryTrack
}>()

const library = useLibraryStore()

// Исходные значения для отслеживания изменений
const initialArtist = props.track.artist ?? ''
const initialTitle = props.track.title ?? ''
const initialAlbum = props.track.album ?? ''
const initialCoverUrl = props.track.coverUrl

const artist = ref(initialArtist)
const title = ref(initialTitle)
const album = ref(initialAlbum)
const coverUrl = ref(initialCoverUrl)

// --- Кандидаты из интернета -----------------------------------------

const candidates = ref<MetadataCandidate[]>([])
const isLoadingCandidates = ref(false)
const selectedCandidateIndex = ref<number | null>(null)

async function loadCandidates() {
  if (!props.track.title?.trim()) return
  isLoadingCandidates.value = true
  try {
    const result = await trackMetadataService.fetch(
      props.track.artist ?? '',
      props.track.title,
      0, // Берем всех, кого нашли
    )
    if (result.status === 'found') {
      if (result.data.candidates && result.data.candidates.length > 0) {
        candidates.value = result.data.candidates
      } else {
        candidates.value = [{
          artist: result.data.artist,
          title: result.data.title,
          album: result.data.album,
          coverUrl: result.data.coverUrl,
          source: result.data.source,
          similarity: result.data.similarity,
        }]
      }
    }
  } catch (err) {
    console.warn('[metadata-modal] failed to load candidates', err)
  } finally {
    isLoadingCandidates.value = false
  }
}

function selectCandidate(index: number) {
  const c = candidates.value[index]
  if (!c) return
  artist.value = c.artist
  title.value = c.title
  album.value = c.album
  coverUrl.value = c.coverUrl ?? undefined
  selectedCandidateIndex.value = index
  isDropdownOpen.value = false
}

// --- Локальный дропдаун ---------------------------------------------

const isDropdownOpen = ref(false)
const dropdownRef = ref<HTMLElement | null>(null)

function toggleDropdown() {
  isDropdownOpen.value = !isDropdownOpen.value
}

function handleClickOutside(e: MouseEvent) {
  if (dropdownRef.value && !dropdownRef.value.contains(e.target as Node)) {
    isDropdownOpen.value = false
  }
}

const selectedCandidateLabel = computed(() => {
  if (selectedCandidateIndex.value === null) return 'Выберите вариант...'
  const c = candidates.value[selectedCandidateIndex.value]
  return c ? `${c.artist} — ${c.title}` : 'Выберите вариант...'
})

onMounted(() => {
  void loadCandidates()
  document.addEventListener('mousedown', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', handleClickOutside)
})

// --- Автокомплит ------------------------------------------------------

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

// --- Изменения и сохранение ------------------------------------------

const isDirty = computed(() => {
  return (
    artist.value !== initialArtist ||
    title.value !== initialTitle ||
    album.value !== initialAlbum ||
    coverUrl.value !== initialCoverUrl
  )
})

function save() {
  const newArtist = artist.value.trim()
  const newTitle = title.value.trim()
  const newAlbum = album.value.trim()

  if (!newTitle) {
    toastService.error('Название трека не может быть пустым')
    return
  }

  metadataService.updateManual(props.track.id, {
    artist: newArtist,
    title: newTitle,
    album: newAlbum,
    coverUrl: coverUrl.value,
  })

  toastService.success('Метаданные обновлены')
  modalService.confirm()
}

function cancel() {
  if (isDirty.value) {
    const confirmed = window.confirm('Есть несохраненные изменения. Закрыть без сохранения?')
    if (!confirmed) return
  }
  modalService.cancel()
}

function handleBeforeUnload(e: BeforeUnloadEvent) {
  if (isDirty.value) {
    e.preventDefault()
    e.returnValue = ''
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault()
    e.stopPropagation()
    cancel()
  }
}

onMounted(() => {
  window.addEventListener('beforeunload', handleBeforeUnload)
  window.addEventListener('keydown', handleKeydown, true)
})

onUnmounted(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload)
  window.removeEventListener('keydown', handleKeydown, true)
})
</script>

<template>
  <ModalLayout title="Редактировать метаданные" max-width="md" :disable-backdrop-close="true" @close="cancel">
    <form class="flex flex-col gap-4" @submit.prevent="save">
      <!-- Обложка -->
      <div class="flex justify-center pb-2">
        <CoverPicker v-model="coverUrl" />
      </div>

      <!-- Кандидаты из интернета -->
      <div v-if="isLoadingCandidates">
        <Spinner size="sm" text="Поиск вариантов в интернете…" />
      </div>

      <div v-else-if="candidates.length > 0" class="flex flex-col gap-1 relative" ref="dropdownRef">
        <label class="text-xs text-fg-muted">Найденные варианты</label>

        <!-- Триггер -->
        <button type="button"
          class="flex w-full items-center justify-between rounded-btn bg-card-bg px-3 py-2 text-sm text-fg transition hover:bg-hover-bg"
          @click="toggleDropdown">
          <span class="truncate">{{ selectedCandidateLabel }}</span>
          <Icon name="chevron-down" w="w-4" h="h-4" class="shrink-0 text-fg-muted ml-2 transition"
            :class="isDropdownOpen ? 'rotate-180' : ''" />
        </button>

        <!-- Список -->
        <div v-if="isDropdownOpen"
          class="absolute top-full left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-btn bg-bg-elevated shadow-lg border border-hover-bg">
          <button v-for="(c, i) in candidates" :key="i" type="button"
            class="flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition hover:bg-hover-bg"
            :class="selectedCandidateIndex === i ? 'bg-active/10' : ''" @click="selectCandidate(i)">

            <!-- Обложка кандидата -->
            <div class="h-10 w-10 shrink-0 overflow-hidden rounded-btn bg-card-bg">
              <CoverImage :src="c.coverUrl" :alt="c.title" fallback-icon-class="h-4 w-4" />
            </div>

            <div class="min-w-0 flex-1">
              <span class="block truncate"
                :class="selectedCandidateIndex === i ? 'text-active font-medium' : 'text-fg'">
                {{ c.artist }} — {{ c.title }}
              </span>
              <span class="block truncate text-xs text-fg-muted">{{ c.album }}</span>
            </div>
          </button>
        </div>
      </div>

      <FormField label="Артист">
        <AutocompleteInput v-model="artist" :suggestions="allArtists" placeholder="Введите артиста..."
          id="track-artist" />
      </FormField>

      <FormField label="Название">
        <Input v-model="title" type="text" placeholder="Введите название..." />
      </FormField>

      <FormField label="Альбом">
        <AutocompleteInput v-model="album" :suggestions="allAlbums" placeholder="Введите альбом..." id="track-album" />
      </FormField>
    </form>

    <template #footer>
      <div class="flex items-center justify-end gap-2">
        <Button variant="ghost" @click="cancel">Отмена</Button>
        <Button variant="primary" :disabled="!title.trim()" @click="save">Сохранить</Button>
      </div>
    </template>
  </ModalLayout>
</template>
