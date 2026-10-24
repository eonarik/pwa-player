<!-- src/components/ui/ListContainer.vue -->
<script setup lang="ts">
withDefaults(
  defineProps<{
    maxWidth?: 'sm' | 'md' | 'lg'
  }>(),
  {
    maxWidth: 'md', // max-w-3xl
  },
)
</script>

<template>
  <div class="mx-auto flex w-full flex-col gap-0.5 py-2" :class="{
    'max-w-2xl': maxWidth === 'sm',
    'max-w-3xl': maxWidth === 'md',
    'max-w-5xl': maxWidth === 'lg',
  }">
    <slot />
  </div>
</template>
