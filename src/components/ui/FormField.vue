<!-- src/components/ui/FormField.vue -->
<script setup lang="ts">
import Label from './Label.vue'

withDefaults(
  defineProps<{
    label?: string
    hint?: string
    error?: string
    id?: string
  }>(),
  {},
)
</script>

<template>
  <div class="flex flex-col gap-1">
    <Label v-if="label" :text="label" :for="id" />
    <slot />
    <p v-if="error" class="text-xs text-red-400">{{ error }}</p>
    <p v-else-if="hint" class="text-xs text-fg-muted">{{ hint }}</p>
  </div>
</template>
