<!-- src/components/library/TrackResolvedItem.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { useLibraryStore } from '@/stores/library'
import TrackListItem from './TrackListItem.vue'
import TrackActions from './TrackActions.vue'
import type { LibraryTrack } from '@/types/library'

const props = defineProps<{
  /** ID трека в библиотеке */
  trackId: string
  /** Порядковый номер для отображения */
  index: number
  /** Текущий ли трек играет */
  isCurrent: boolean
  /** Играет ли плеер сейчас */
  isPlaying: boolean
  /** Если задан — показываем кнопку «Убрать из плейлиста» */
  playlistId?: string
  /** Дополнительный контент в слоте actions (слева от TrackActions) */
  metaLabel?: string
}>()

const emit = defineEmits<{
  (e: 'select'): void
  (e: 'removed'): void
}>()

const library = useLibraryStore()

const track = computed<LibraryTrack | null>(() => library.getTrack(props.trackId))

function onSelect() {
  emit('select')
}
</script>

<template>
  <!-- Трек доступен -->
  <TrackListItem v-if="track" :track="track" :index="index" :is-current="isCurrent" :is-playing="isPlaying"
    @select="onSelect">
    <template #actions>
      <span v-if="metaLabel" class="mr-2 text-[10px] tabular-nums text-fg-subtle">
        {{ metaLabel }}
      </span>
      <TrackActions :track="track" :playlist-id="playlistId" @removed-from-playlist="emit('removed')" />
    </template>
  </TrackListItem>

  <!-- Трек недоступен -->
  <div v-else class="group flex items-center gap-3 px-3 py-2 text-fg-subtle">
    <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-btn bg-card-bg">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-4 w-4">
        <path d="M18 6L6 18M6 6l12 12" />
      </svg>
    </div>

    <div class="min-w-0 flex-1">
      <p class="truncate text-sm line-through">Источник недоступен</p>
      <p class="truncate text-xs">Трек отсутствует в библиотеке</p>
    </div>

    <span v-if="metaLabel" class="text-[10px] tabular-nums text-fg-disabled">
      {{ metaLabel }}
    </span>

    <button v-if="playlistId" type="button"
      class="rounded-btn p-1.5 text-fg-subtle opacity-0 transition hover:bg-hover-bg hover:text-red-400 group-hover:opacity-100"
      aria-label="Убрать из плейлиста" @click.stop="emit('removed')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-4 w-4">
        <path d="M18 6L6 18M6 6l12 12" />
      </svg>
    </button>
  </div>
</template>
