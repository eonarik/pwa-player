<!-- src/components/ui/Avatar.vue -->

<script setup lang="ts">
import { ref, watch } from 'vue';
import Icon from './Icon.vue';

const props = withDefaults(
  defineProps<{
    src?: string | null;
    alt?: string;
    size?: 'sm' | 'md' | 'lg';
  }>(),
  { alt: '', size: 'md' },
);

const hasError = ref(false);
watch(
  () => props.src,
  () => {
    hasError.value = false;
  },
);

const SIZE_MAP = {
  sm: { container: 'h-10 w-10', icon: 'w-5 h-5' },
  md: { container: 'h-16 w-16', icon: 'w-8 h-8' },
  lg: { container: 'h-24 w-24', icon: 'w-12 h-12' },
};
</script>

<template>
  <div
    :class="[
      SIZE_MAP[size].container,
      'relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-card-bg',
    ]"
  >
    <img v-if="src && !hasError" :src="src" :alt="alt" class="h-full w-full object-cover" @error="hasError = true" />
    <Icon
      v-else
      name="artist"
      :w="SIZE_MAP[size].icon.split(' ')[0]"
      :h="SIZE_MAP[size].icon.split(' ')[1]"
      class="text-fg-subtle"
    />
  </div>
</template>
