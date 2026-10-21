<!-- src/components/player/NowPlayingInfo.vue -->
<script setup lang="ts">
import CoverImage from '@/components/ui/CoverImage.vue'
import type { Track } from '@/types/track'

withDefaults(
  defineProps<{
    track: Track | null
    /** Tailwind-классы размера обложки (h-16 w-16 и т.п.). */
    coverClass?: string
    /** Размер fallback-иконки внутри обложки. */
    fallbackIconClass?: string
    /** Показывать артиста (в мобильной версии — опционально). */
    showArtist?: boolean
    /** Выравнивание текста. */
    align?: 'left' | 'center'
  }>(),
  {
    coverClass: 'h-16 w-16',
    fallbackIconClass: 'h-6 w-6',
    showArtist: true,
    align: 'left',
  },
)
</script>

<template>
  <div class="flex min-w-0 items-center gap-3">
    <div class="aspect-square shrink-0 overflow-hidden bg-card-bg" :class="coverClass">
      <CoverImage :src="track?.coverUrl" :alt="track?.album ?? ''" :fallback-icon-class="fallbackIconClass" />
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
