<!-- src/components/ui/Toolbar.vue -->
<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'default' | 'border'
  }>(),
  {
    variant: 'default',
  },
)
</script>

<template>
  <div class="flex items-center gap-2" :class="variant === 'border' ? 'border-b border-hover-bg pb-2' : ''">
    <slot />
  </div>
</template>
