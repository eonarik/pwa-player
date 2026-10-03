<!-- src/components/settings/PluginSettingsSection.vue -->
<script setup lang="ts">
import type { PluginSettingsField, PluginSettingsSection } from '@/plugins/settingsTypes'
import ActionField from './fields/ActionField.vue'
import TextField from './fields/TextField.vue'
import NumberField from './fields/NumberField.vue'
import ToggleField from './fields/ToggleField.vue'
import FolderListField from './fields/FolderListField.vue'

defineProps<{
  section: PluginSettingsSection
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'action', id: string, payload?: unknown): void
  (e: 'change', id: string, value: unknown): void
}>()

function onAction(id: string, payload?: unknown) {
  emit('action', id, payload)
}

function onChange(id: string, value: unknown) {
  emit('change', id, value)
}

function fieldKey(field: PluginSettingsField): string {
  return field.id
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div v-if="section.title">
      <p class="text-xs font-medium uppercase tracking-wider text-fg-subtle">
        {{ section.title }}
      </p>
      <p v-if="section.description" class="mt-1 text-xs text-fg-muted">
        {{ section.description }}
      </p>
    </div>

    <template v-for="field in section.fields" :key="fieldKey(field)">
      <ActionField
        v-if="field.type === 'action'"
        :field="field"
        :disabled="disabled"
        @action="onAction"
      />

      <TextField v-else-if="field.type === 'text'" :field="field" @change="onChange" />

      <NumberField v-else-if="field.type === 'number'" :field="field" @change="onChange" />

      <ToggleField v-else-if="field.type === 'toggle'" :field="field" @change="onChange" />

      <FolderListField
        v-else-if="field.type === 'folderList'"
        :field="field"
        :disabled="disabled"
        @action="onAction"
      />
    </template>
  </div>
</template>
