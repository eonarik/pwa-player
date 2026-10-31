<!-- src/components/ui/CoverImage.vue -->

<script setup lang="ts">
import { ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    src: string | null | undefined;
    alt?: string;
    fallbackIconClass?: string;
    variant?: 'album' | 'artist';
  }>(),
  {
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

watch(
  () => props.src,
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
    v-if="src && !hasError"
    :src="src"
    :alt="alt"
    class="h-full w-full object-cover"
    loading="lazy"
    @error="onError"
    @load="onLoad"
    :data-src-log="src"
  />
</template>
