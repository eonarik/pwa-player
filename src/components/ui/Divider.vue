<!-- src/components/ui/Divider.vue -->
<script setup lang="ts">
withDefaults(
  defineProps<{
    vertical?: boolean
  }>(),
  { vertical: true },
)
</script>

<template>
  <div v-if="vertical" class="mx-1 h-4 border-l border-active/40" aria-hidden="true" />
  <div v-else class="my-2 w-full border-t border-hover-bg" aria-hidden="true" />
</template>
