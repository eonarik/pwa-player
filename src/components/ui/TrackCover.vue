<!-- src/components/ui/TrackCover.vue -->
<script setup lang="ts">
import { computed } from 'vue'
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
    :class="sizeClass">
    <!-- Обложка -->
    <img v-if="hasCover" :src="track.coverUrl" :alt="track.album" class="h-full w-full object-cover" loading="lazy" />

    <!-- Альбом текстом -->
    <span v-else-if="hasAlbum"
      class="line-clamp-3 break-words px-0.5 text-center text-[9px] leading-tight text-fg-subtle">
      {{ track.album }}
    </span>

    <!-- Иконка ноты -->
    <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="h-5 w-5 text-fg-subtle"
      aria-hidden="true">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>

    <!-- Слот для оверлея (PlayingIndicator и т.п.) -->
    <slot />
  </div>
</template>
