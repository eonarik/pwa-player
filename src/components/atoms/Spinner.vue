<!-- src/components/ui/Spinner.vue -->

<script setup lang="ts">
import Icon from './Icon.vue';

withDefaults(
  defineProps<{
    size?: 'sm' | 'md' | 'lg';
    text?: string;
  }>(),
  { size: 'md' },
);

const SIZE_MAP = {
  sm: { w: 'w-3.5', h: 'h-3.5' },
  md: { w: 'w-5', h: 'h-5' },
  lg: { w: 'w-6', h: 'h-6' },
};
</script>

<template>
  <div class="flex items-center gap-2 text-fg-muted">
    <Icon name="spinner" :w="SIZE_MAP[size].w" :h="SIZE_MAP[size].h" class="animate-spin" />
    <span v-if="text" class="text-xs">{{ text }}</span>
  </div>
</template>
