<!-- src/components/ui/CoverImage.vue -->

<script setup lang="ts">
import { computed, ref, toRef, watch } from 'vue';
import { useAlbumCover } from '@/composables/useAlbumCover';
import type { AlbumId } from '@/types/ids';

const props = withDefaults(
  defineProps<{
    src?: string | null;
    albumId?: AlbumId | null;
    alt?: string;
    fallbackIconClass?: string;
    variant?: 'album' | 'artist';
  }>(),
  {
    src: null,
    albumId: null,
    alt: '',
    fallbackIconClass: 'h-5 w-5',
    variant: 'album',
  },
);

const emit = defineEmits<{
  (e: 'error'): void;
  (e: 'load'): void;
}>();

const hasError = ref(false);

const albumIdRef = toRef(props, 'albumId');
const albumCoverSrc = useAlbumCover(albumIdRef);

const effectiveSrc = computed(() => {
  if (props.albumId) return albumCoverSrc.value;
  return props.src ?? null;
});

watch(
  () => effectiveSrc.value,
  () => {
    hasError.value = false;
  },
);

function onError(): void {
  hasError.value = true;
  emit('error');
}

function onLoad(): void {
  emit('load');
}

defineExpose({ hasError });
</script>

<template>
  <img
    v-if="effectiveSrc && !hasError"
    :src="effectiveSrc"
    :alt="alt"
    class="h-full w-full object-cover"
    loading="lazy"
    @error="onError"
    @load="onLoad"
    :data-src-log="effectiveSrc"
  />
</template>
