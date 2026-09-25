<!-- src/components/library/TrackListItem.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import type { Track } from '@/types/track'

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
</script>

<template>
  <button
    type="button"
    class="group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition"
    :class="isCurrent ? 'bg-emerald-500/10 text-emerald-400' : 'text-zinc-300 hover:bg-zinc-800/60'"
    @click="emit('select', index)"
  >
    <!-- Обложка / индекс -->
    <div
      class="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md bg-zinc-800"
    >
      <img
        v-if="track.coverUrl"
        :src="track.coverUrl"
        :alt="track.album"
        class="h-full w-full object-cover"
        loading="lazy"
      />
      <span v-else class="text-xs font-medium text-zinc-500">
        {{ index + 1 }}
      </span>

      <!-- Индикатор «играет сейчас» -->
      <div
        v-if="isCurrent && isPlaying"
        class="absolute inset-0 flex items-center justify-center bg-black/50"
      >
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
      <p class="truncate text-xs text-zinc-500">{{ track.artist }}</p>
    </div>

    <!-- Длительность -->
    <span class="shrink-0 text-xs tabular-nums text-zinc-500">
      {{ durationLabel }}
    </span>
  </button>
</template>
