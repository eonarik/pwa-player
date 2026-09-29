<!-- src/components/library/TrackListItem.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import TrackOriginButton from './TrackOriginButton.vue'
import type { Track } from '@/types/track'
import type { LibraryTrack } from '@/types/library'

const props = defineProps<{
  track: Track
  index: number
  isCurrent: boolean
  isPlaying: boolean
}>()

const emit = defineEmits<{
  (e: 'select', index: number): void
}>()

const durationLabel = computed(() => {
  const d = props.track.duration
  if (!d || !Number.isFinite(d)) return '--:--'
  const total = Math.floor(d)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
})

const showOriginButton = computed(() => {
  if (!('pluginId' in props.track)) return false
  if (props.track.pluginId === 'local') return false
  return true
})

const libraryTrack = computed(() => props.track as LibraryTrack)
</script>

<template>
  <div class="group relative">
    <button type="button" class="flex w-full items-center gap-3 px-3 py-2 text-left transition" :class="isCurrent ? 'bg-emerald-500/10 text-emerald-400' : 'text-fg hover:bg-hover-bg'
      " @click="emit('select', index)">
      <!-- Обложка / индекс -->
      <div class="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-btn bg-card-bg">
        <img v-if="track.coverUrl" :src="track.coverUrl" :alt="track.album" class="h-full w-full object-cover"
          loading="lazy" />
        <span v-else class="text-xs font-medium text-fg-muted">
          {{ index + 1 }}
        </span>

        <!-- Индикатор «играет сейчас» -->
        <div v-if="isCurrent && isPlaying" class="absolute inset-0 flex items-center justify-center bg-bg/50">
          <span class="flex gap-0.5">
            <span class="h-3 w-0.5 animate-pulse bg-emerald-400" />
            <span class="h-4 w-0.5 animate-pulse bg-emerald-400 [animation-delay:150ms]" />
            <span class="h-2 w-0.5 animate-pulse bg-emerald-400 [animation-delay:300ms]" />
          </span>
        </div>
      </div>

      <!-- Название и артист -->
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-medium">{{ track.title }}</p>
        <p class="truncate text-xs text-fg-muted">{{ track.artist }}</p>
      </div>

      <!-- Длительность -->
      <span class="shrink-0 text-xs tabular-nums text-fg-muted transition-opacity"
        :class="showOriginButton || $slots.actions ? 'group-hover:opacity-0' : ''">
        {{ durationLabel }}
      </span>
    </button>

    <!-- Кнопка origin + actions справа -->
    <div class="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
      <TrackOriginButton v-if="showOriginButton" :track="libraryTrack" />
      <slot name="actions" />
    </div>
  </div>
</template>
