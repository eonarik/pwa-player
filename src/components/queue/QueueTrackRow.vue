<!-- src/components/queue/QueueTrackRow.vue -->
<script setup lang="ts">
import TrackRow from '@/components/library/TrackRow.vue'
import TrackActions from '@/components/library/TrackActions.vue'
import type { Track } from '@/types/track'

defineProps<{
  track: Track
  index: number
  isCurrent: boolean
  isPlaying: boolean
}>()

const emit = defineEmits<{
  (e: 'select'): void
  (e: 'remove'): void
}>()
</script>

<template>
  <TrackRow
    :track="track"
    :index="index"
    :is-current="isCurrent"
    :is-playing="isPlaying"
    show-download
    @select="emit('select')"
  >
    <template #actions>
      <TrackActions :track="track" :queue-index="index" @removed-from-queue="emit('remove')" />
    </template>
  </TrackRow>
</template>
