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

const coverUrl = computed(() => album.value?.coverUrl ?? props.track.coverUrl ?? null);
const hasCover = computed(() => Boolean(coverUrl.value));
const albumName = computed(() => album.value?.name ?? '');
</script>

<template>
  <div
    class="track-cover relative flex shrink-0 items-center justify-center overflow-hidden rounded-btn bg-card-bg"
    :class="[sizeClass, !albumName && 'track-cover_empty']"
  >
    <span
      v-if="!hasCover && albumName"
      class="line-clamp-3 break-words px-0.5 text-center text-[9px] leading-tight text-fg-subtle"
    >
      {{ albumName }}
    </span>
    <CoverImage v-else :src="coverUrl" :alt="albumName" fallback-icon-class="h-5 w-5" />
    <slot />
  </div>
</template>
