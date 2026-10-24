<!-- src/components/ui/ProgressBar.vue -->
<script setup lang="ts">
withDefaults(
  defineProps<{
    value: number
    max?: number
    size?: 'sm' | 'md'
  }>(),
  { max: 100, size: 'md' },
)

const HEIGHT_MAP = {
  sm: 'h-1',
  md: 'h-1.5',
}
</script>

<template>
  <div class="w-full overflow-hidden rounded-full bg-hover-bg" :class="HEIGHT_MAP[size]">
    <div class="h-full rounded-full bg-accent transition-[width]" :style="{ width: `${(value / max) * 100}%` }" />
  </div>
</template>
