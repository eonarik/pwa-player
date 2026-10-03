<!-- src/components/library/TrackResolvedItem.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { useLibraryStore } from '@/stores/library'
import TrackRow from './TrackRow.vue'
import TrackActions from './TrackActions.vue'
import IconX from '@/components/icons/IconX.vue'
import type { LibraryTrack } from '@/types/library'

const props = defineProps<{
  trackId: string
  index: number
  isCurrent: boolean
  isPlaying: boolean
  playlistId?: string
  metaLabel?: string
}>()

const emit = defineEmits<{
  (e: 'select'): void
  (e: 'removed'): void
}>()

const library = useLibraryStore()

const track = computed<LibraryTrack | null>(() => library.getTrack(props.trackId))
</script>

<template>
  <TrackRow
    v-if="track"
    :track="track"
    :index="index"
    :is-current="isCurrent"
    :is-playing="isPlaying"
    show-download
    @select="emit('select')"
  >
    <template #actions>
      <span v-if="metaLabel" class="mr-2 text-[10px] tabular-nums text-fg-subtle">
        {{ metaLabel }}
      </span>
      <TrackActions
        :track="track"
        :playlist-id="playlistId"
        @removed-from-playlist="emit('removed')"
      />
    </template>
  </TrackRow>

  <!-- Трек недоступен -->
  <div v-else class="group flex items-center gap-3 px-3 py-2 text-fg-subtle">
    <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-btn bg-card-bg">
      <IconX class="h-4 w-4" />
    </div>

    <div class="min-w-0 flex-1">
      <p class="truncate text-sm line-through">Источник недоступен</p>
      <p class="truncate text-xs">Трек отсутствует в библиотеке</p>
    </div>

    <span v-if="metaLabel" class="text-[10px] tabular-nums text-fg-disabled">
      {{ metaLabel }}
    </span>

    <button
      v-if="playlistId"
      type="button"
      class="rounded-btn p-1.5 text-fg-subtle opacity-0 transition hover:bg-hover-bg hover:text-red-400 group-hover:opacity-100"
      aria-label="Убрать из плейлиста"
      @click.stop="emit('removed')"
    >
      <IconX class="h-4 w-4" />
    </button>
  </div>
</template>
