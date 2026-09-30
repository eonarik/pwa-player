<!-- src/components/queue/QueueTrackRow.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import ListRow from '@/components/ui/ListRow.vue'
import PlayingIndicator from '@/components/ui/PlayingIndicator.vue'
import type { Track } from '@/types/track'

const props = defineProps<{
  track: Track
  index: number
  isCurrent: boolean
  isPlaying: boolean
}>()

const emit = defineEmits<{
  (e: 'select'): void
  (e: 'remove'): void
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
  <ListRow :active="isCurrent" @click="emit('select')">
    <!-- Leading -->
    <template #leading>
      <div class="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-btn bg-card-bg">
        <img v-if="track.coverUrl" :src="track.coverUrl" :alt="track.album" class="h-full w-full object-cover"
          loading="lazy" />
        <span v-else class="text-xs font-medium text-fg-muted">
          {{ index + 1 }}
        </span>

        <PlayingIndicator v-if="isCurrent && isPlaying" />
      </div>
    </template>

    <!-- Title -->
    <template #title>
      <p class="truncate text-sm font-medium">
        {{ track.title }}
        <span v-if="isCurrent && !isPlaying" class="ml-1 text-xs text-active/70">(пауза)</span>
      </p>
    </template>

    <!-- Subtitle -->
    <template #subtitle>
      <p class="truncate text-xs text-fg-muted">{{ track.artist }}</p>
    </template>

    <!-- Meta: duration -->
    <template #meta>
      <span class="shrink-0 text-xs tabular-nums text-fg-muted">
        {{ durationLabel }}
      </span>
    </template>

    <!-- Trailing: remove -->
    <template #trailing>
      <button type="button"
        class="shrink-0 rounded-btn p-1.5 text-fg-subtle transition hover:bg-hover-bg hover:text-red-400 md:opacity-0 md:group-hover:opacity-100"
        aria-label="Убрать из очереди" @click="emit('remove')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-4 w-4">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </template>
  </ListRow>
</template>
