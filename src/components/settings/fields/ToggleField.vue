<!-- src/components/settings/fields/ToggleField.vue -->
<script setup lang="ts">
import type { PluginSettingsToggle } from '@/plugins/settingsTypes'

defineProps<{
  field: PluginSettingsToggle
}>()

const emit = defineEmits<{
  (e: 'change', id: string, value: boolean): void
}>()
</script>

<template>
  <label class="flex cursor-pointer items-center justify-between gap-4 bg-card-bg px-4 py-3">
    <div class="min-w-0">
      <p class="text-sm text-fg">{{ field.label }}</p>
      <p v-if="field.description" class="text-xs text-fg-muted">{{ field.description }}</p>
    </div>

    <input
      type="checkbox"
      :checked="field.value"
      class="h-4 w-4 cursor-pointer accent-active"
      @change="emit('change', field.id, ($event.target as HTMLInputElement).checked)"
    />
  </label>
</template>
