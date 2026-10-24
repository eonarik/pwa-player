<!-- src/components/ui/Label.vue -->
<script setup lang="ts">
withDefaults(
  defineProps<{
    text?: string
    for?: string
  }>(),
  {},
)
</script>

<template>
  <label :for="$props.for" class="mb-1 block text-xs text-fg-muted">
    <slot>{{ text }}</slot>
  </label>
</template>
