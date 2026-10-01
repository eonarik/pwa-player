<!-- src/components/settings/fields/TextField.vue -->
<script setup lang="ts">
import { ref, watch } from 'vue'
import type { PluginSettingsText } from '@/plugins/settingsTypes'

const props = defineProps<{
  field: PluginSettingsText
}>()

const emit = defineEmits<{
  (e: 'change', id: string, value: string): void
}>()

const local = ref(props.field.value)

watch(
  () => props.field.value,
  (v) => {
    local.value = v
  },
)

function commit() {
  emit('change', props.field.id, local.value)
}
</script>

<template>
  <div class="flex items-center justify-between gap-4 bg-card-bg px-4 py-3">
    <div class="min-w-0">
      <p class="text-sm text-fg">{{ field.label }}</p>
      <p v-if="field.description" class="text-xs text-fg-muted">{{ field.description }}</p>
    </div>

    <input v-model="local" type="text" :placeholder="field.placeholder"
      class="w-40 rounded-btn bg-bg-elevated px-2 py-1 text-right text-sm text-fg placeholder:text-fg-subtle focus:outline-none"
      @blur="commit" @keydown.enter="commit" />
  </div>
</template>
