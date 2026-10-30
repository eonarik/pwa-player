<!-- src/components/settings/fields/ActionField.vue -->

<script setup lang="ts">
import type { PluginSettingsAction } from '@/plugins/settingsTypes';
import SettingsActionRow from '@/components/ui/SettingsActionRow.vue';

defineProps<{
  field: PluginSettingsAction;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (e: 'action', id: string): void;
}>();
</script>

<template>
  <SettingsActionRow
    :title="field.label"
    :description="field.description"
    :variant="field.variant"
    @click="emit('action', field.id)"
    :disabled="disabled"
  />
</template>
