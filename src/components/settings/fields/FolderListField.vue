<!-- src/components/settings/fields/FolderListField.vue -->

<script setup lang="ts">
import type { PluginSettingsFolderList } from '@/plugins/settingsTypes';
import Button from '@/components/ui/Button.vue';

defineProps<{
  field: PluginSettingsFolderList;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (e: 'action', id: string, payload: unknown): void;
}>();

function statusLabel(status: string): string {
  if (status === 'granted') return 'Доступ есть';
  if (status === 'prompt') return 'Требуется подтверждение';
  if (status === 'denied') return 'Доступ запрещён';
  return 'Неизвестно';
}

function statusClass(status: string): string {
  if (status === 'granted') return 'text-fg-muted';
  if (status === 'prompt') return 'text-amber-400';
  return 'text-red-400';
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div v-if="field.folders.length === 0" class="bg-card-bg px-4 py-3 text-xs text-fg-muted">Папок нет.</div>

    <div
      v-for="folder in field.folders"
      :key="folder.name"
      class="flex items-center justify-between gap-3 bg-card-bg px-4 py-3"
    >
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm text-fg">{{ folder.name }}</p>
        <p class="text-xs" :class="statusClass(folder.status)">
          {{ statusLabel(folder.status) }}
        </p>
      </div>

      <div class="flex shrink-0 items-center gap-1">
        <Button
          variant="secondary"
          size="sm"
          :disabled="disabled"
          @click="emit('action', 'rescan-folder', { name: folder.name })"
        >
          Обновить
        </Button>

        <Button
          variant="danger"
          size="sm"
          :disabled="disabled"
          @click="emit('action', 'remove-folder', { name: folder.name })"
        >
          Удалить
        </Button>
      </div>
    </div>
  </div>
</template>
