<!-- src/components/ui/TrackCover.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { useLibraryStore } from '@/stores/library'
import CoverImage from './CoverImage.vue'
import type { Track } from '@/types/track'

const props = defineProps<{ track: Track; size?: string }>()
const library = useLibraryStore()
const sizeClass = computed(() => props.size ?? 'h-11 w-11')

const coverUrl = computed(() => {
  if (props.track.albumId) {
    const album = library.getAlbum(props.track.albumId)
    if (album?.coverUrl) return album.coverUrl
  }
  // Для радио и подкастов (без альбомов)
  return props.track.coverUrl
})

const hasCover = computed(() => Boolean(coverUrl.value))
const hasAlbum = computed(() => Boolean(props.track.album?.trim()))
</script>

<template>
  <div class="track-cover relative flex shrink-0 items-center justify-center overflow-hidden rounded-btn bg-card-bg"
    :class="[sizeClass, !props.track.album && 'track-cover_empty']">
    <span v-if="!hasCover && hasAlbum"
      class="line-clamp-3 break-words px-0.5 text-center text-[9px] leading-tight text-fg-subtle">
      {{ props.track.album }}
    </span>
    <CoverImage v-else :src="coverUrl" :alt="props.track.album" fallback-icon-class="h-5 w-5" />
    <slot />
  </div>
</template>
