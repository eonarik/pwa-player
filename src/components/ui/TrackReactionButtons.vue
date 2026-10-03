<!-- src/components/ui/TrackReactionButtons.vue -->
<script setup lang="ts">
import DislikeButton from './DislikeButton.vue'
import FavoriteButton from './FavoriteButton.vue'
import type { Track } from '@/types/track'

withDefaults(
  defineProps<{
    track: Track | null | undefined
    size?: 'sm' | 'md' | 'lg'
    dislikeMode?: 'toggle' | 'skip'
  }>(),
  { size: 'md', dislikeMode: 'toggle' },
)
</script>

<template>
  <div class="flex items-center gap-0.5">
    <DislikeButton :track="track" :size="size" :mode="dislikeMode" />
    <FavoriteButton :track="track" :size="size" />
  </div>
</template>
