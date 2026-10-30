<!-- src/components/ui/EmptyState.vue -->

<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string;
    description?: string;
  }>(),
  {},
);
</script>

<template>
  <div class="flex flex-col items-center justify-center py-16 text-center text-sm text-fg-muted">
    <div class="mb-3 flex h-10 w-10 items-center justify-center text-fg-subtle">
      <slot name="icon" />
    </div>
    <p class="font-medium text-fg">{{ title }}</p>
    <p v-if="description" class="mt-1 text-xs">{{ description }}</p>
    <slot />
  </div>
</template>
