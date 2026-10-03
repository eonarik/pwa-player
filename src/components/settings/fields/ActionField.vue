<!-- src/components/settings/fields/ActionField.vue -->
<script setup lang="ts">
import type { PluginSettingsAction } from '@/plugins/settingsTypes'

defineProps<{
  field: PluginSettingsAction
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'action', id: string): void
}>()
</script>

<template>
  <button
    type="button"
    class="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition disabled:opacity-50"
    :class="
      field.variant === 'danger'
        ? 'bg-red-500/10 hover:bg-red-500/15'
        : 'bg-card-bg hover:bg-hover-bg'
    "
    :disabled="disabled"
    @click="emit('action', field.id)"
  >
    <div class="min-w-0">
      <p class="text-sm" :class="field.variant === 'danger' ? 'text-red-400' : 'text-fg'">
        {{ field.label }}
      </p>
      <p
        v-if="field.description"
        class="text-xs"
        :class="field.variant === 'danger' ? 'text-red-400/70' : 'text-fg-muted'"
      >
        {{ field.description }}
      </p>
    </div>
  </button>
</template>
