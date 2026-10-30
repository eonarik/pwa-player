<!-- src/components/ui/Divider.vue -->

<script setup lang="ts">
defineProps<{
  vertical?: boolean;
  withMargin?: boolean;
}>();
</script>

<template>
  <div v-if="vertical" class="h-4 border-l border-active/40" :class="[withMargin ?? 'mx-1']" aria-hidden="true" />
  <div v-else class="w-full border-t border-hover-bg" :class="[withMargin ?? 'my-2']" aria-hidden="true" />
</template>
