<!-- src/components/library/TrackListItem.vue -->

<script setup lang="ts">
import TrackRow from './TrackRow.vue';
import type { Track } from '@/types/track';

withDefaults(
  defineProps<{
    track: Track;
    index: number;
    isCurrent: boolean;
    isPlaying: boolean;
    testIdPrefix?: string;
  }>(),
  {
    testIdPrefix: 'track-row',
  },
);

const emit = defineEmits<{
  (e: 'select', index: number): void;
}>();
</script>

<template>
  <TrackRow
    :track="track"
    :index="index"
    :is-current="isCurrent"
    :is-playing="isPlaying"
    :test-id-prefix="testIdPrefix"
    show-download
    @select="emit('select', index)"
  >
    <template #actions>
      <slot name="actions" />
    </template>
  </TrackRow>
</template>
