<!-- src/components/settings/fields/NumberField.vue -->
<script setup lang="ts">
import { ref, watch } from 'vue'
import type { PluginSettingsNumber } from '@/plugins/settingsTypes'

const props = defineProps<{
  field: PluginSettingsNumber
}>()

const emit = defineEmits<{
  (e: 'change', id: string, value: number): void
}>()

const local = ref(props.field.value)

watch(
  () => props.field.value,
  (v) => {
    local.value = v
  },
)

function commit() {
  const v = Number(local.value)
  if (!Number.isFinite(v)) {
    local.value = props.field.value
    return
  }
  if (props.field.min !== undefined && v < props.field.min) {
    local.value = props.field.value
    return
  }
  if (props.field.max !== undefined && v > props.field.max) {
    local.value = props.field.value
    return
  }
  emit('change', props.field.id, v)
}
</script>

<template>
  <div class="flex items-center justify-between gap-4 bg-card-bg px-4 py-3">
    <div class="min-w-0">
      <p class="text-sm text-fg">{{ field.label }}</p>
      <p v-if="field.description" class="text-xs text-fg-muted">{{ field.description }}</p>
    </div>

    <input v-model.number="local" type="number" :min="field.min" :max="field.max" :step="field.step ?? 1"
      class="w-20 rounded-btn bg-bg-elevated px-2 py-1 text-right text-sm text-fg focus:outline-none" @blur="commit"
      @keydown.enter="commit" />
  </div>
</template>
