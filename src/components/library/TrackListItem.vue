<!-- src/components/library/TrackListItem.vue -->
<script setup lang="ts">
import TrackRow from './TrackRow.vue'
import type { Track } from '@/types/track'

defineProps<{
  track: Track
  index: number
  isCurrent: boolean
  isPlaying: boolean
}>()

const emit = defineEmits<{
  (e: 'select', index: number): void
}>()
</script>

<template>
  <TrackRow :track="track" :index="index" :is-current="isCurrent" :is-playing="isPlaying" show-download
    @select="emit('select', index)">
    <template #actions>
      <slot name="actions" />
    </template>
  </TrackRow>
</template>
