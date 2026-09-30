<!-- src/components/icons/IconHeart.vue -->
<script setup lang="ts">
withDefaults(
  defineProps<{
    filled?: boolean
  }>(),
  { filled: false },
)
</script>

<template>
  <svg viewBox="0 0 24 24" :fill="filled ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2"
    aria-hidden="true">
    <path d="M12 21s-7-4.35-7-10a5 5 0 019-3 5 5 0 019 3c0 5.65-7 10-7 10z" />
  </svg>
</template>
