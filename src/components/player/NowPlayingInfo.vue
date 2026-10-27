<!-- src/components/player/NowPlayingInfo.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { useLibraryStore } from '@/stores/library'
import CoverImage from '@/components/ui/CoverImage.vue'
import type { Track } from '@/types/track'

const props = withDefaults(
  defineProps<{
    track: Track | null
    coverClass?: string
    fallbackIconClass?: string
    showArtist?: boolean
    align?: 'left' | 'center'
  }>(),
  {
    coverClass: 'h-16 w-16',
    fallbackIconClass: 'h-6 w-6',
    showArtist: true,
    align: 'left',
  },
)

const library = useLibraryStore()

const coverSrc = computed(() => {
  if (!props.track?.albumId) return undefined
  return library.getAlbum(props.track.albumId)?.coverUrl
})
</script>

<template>
  <div class="flex min-w-0 items-center gap-3">
    <div class="track-cover aspect-square shrink-0 overflow-hidden bg-card-bg"
      :class="[coverClass, !coverSrc && 'track-cover_empty']">
      <CoverImage :src="coverSrc" :alt="track?.album ?? ''" :fallback-icon-class="fallbackIconClass" />
    </div>
    <div class="min-w-0" :class="align === 'center' ? 'text-center' : 'text-left'">
      <p class="truncate text-base font-medium text-fg">
        {{ track?.title ?? 'Ничего не играет' }}
      </p>
      <p v-if="showArtist && track?.artist" class="truncate text-xs text-fg-muted">
        {{ track.artist }}
      </p>
    </div>
  </div>
</template>
