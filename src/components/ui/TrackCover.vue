<!-- src/components/ui/TrackCover.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import CoverImage from './CoverImage.vue'
import type { Track } from '@/types/track'

const props = defineProps<{
  track: Track
  /** Класс размера (по умолчанию h-11 w-11) */
  size?: string
}>()

const sizeClass = computed(() => props.size ?? 'h-11 w-11')

const hasCover = computed(() => Boolean(props.track.coverUrl))
const hasAlbum = computed(() => Boolean(props.track.album?.trim()))
</script>

<template>
  <div class="relative flex shrink-0 items-center justify-center overflow-hidden rounded-btn bg-card-bg"
    :class="[sizeClass, !track.album && 'track-cover']">
    <span v-if="!hasCover && hasAlbum"
      class="line-clamp-3 break-words px-0.5 text-center text-[9px] leading-tight text-fg-subtle">
      {{ track.album }}
    </span>
    <CoverImage v-else :src="track.coverUrl" :alt="track.album" fallback-icon-class="h-5 w-5" />
    <slot />
  </div>
</template>
