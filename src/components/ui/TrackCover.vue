<!-- src/components/ui/TrackCover.vue -->

<script setup lang="ts">
import { computed } from 'vue';
import { useLibraryStore } from '@/stores/library';
import CoverImage from './CoverImage.vue';
import type { Track } from '@/types/track';

const props = defineProps<{ track: Track; size?: string }>();
const library = useLibraryStore();
const sizeClass = computed(() => props.size ?? 'h-11 w-11');

const album = computed(() => (props.track.albumId ? library.getAlbum(props.track.albumId) : null));

// 1. Приоритет: track.coverUrl (для радио/подкастов/стриминга).
const trackCover = computed(() => props.track.coverUrl ?? null);

const albumName = computed(() => album.value?.name ?? '');

// Что показываем:
// - 'track' — track.coverUrl
// - 'album' — album.coverBlob/coverUrl через CoverImage :album-id
// - 'album-name' — текст альбома
// - 'empty' — .track-cover_empty
type ViewKind = 'track' | 'album' | 'album-name' | 'empty';

const viewKind = computed<ViewKind>(() => {
  if (trackCover.value) return 'track';
  if (props.track.albumId && album.value) {
    if (album.value.coverBlob || album.value.coverUrl) return 'album';
    return 'album-name';
  }
  return 'empty';
});
</script>

<template>
  <div
    class="track-cover relative flex shrink-0 items-center justify-center overflow-hidden rounded-btn bg-card-bg"
    :class="[sizeClass, viewKind === 'empty' && 'track-cover_empty']"
    data-testid="track-cover"
  >
    <CoverImage
      v-if="viewKind === 'track'"
      :src="trackCover"
      :alt="track.title"
      fallback-icon-class="h-5 w-5"
      data-testid="track-cover-img"
    />

    <CoverImage
      v-else-if="viewKind === 'album'"
      :album-id="track.albumId"
      :alt="albumName"
      fallback-icon-class="h-5 w-5"
      data-testid="track-cover-img"
    />

    <span
      v-else-if="viewKind === 'album-name'"
      class="line-clamp-3 break-words px-0.5 text-center text-[9px] leading-tight text-fg-subtle"
    >
      {{ albumName }}
    </span>

    <slot />
  </div>
</template>
