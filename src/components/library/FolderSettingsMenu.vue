<!-- src/components/library/FolderSettingsMenu.vue -->
<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useUiSettingsStore } from '@/stores/uiSettings'
import DropdownMenu from '@/components/ui/DropdownMenu.vue'
import IconSettings from '@/components/icons/IconSettings.vue'

const uiSettings = useUiSettingsStore()
const { showSource, showFiles } = storeToRefs(uiSettings)
</script>

<template>
  <DropdownMenu :width="224">
    <template #trigger="{ toggle, setTriggerRef }">
      <button
        :ref="setTriggerRef"
        type="button"
        class="flex h-8 w-8 items-center justify-center rounded-btn bg-card-bg text-fg transition hover:bg-hover-bg"
        aria-label="Настройки отображения"
        title="Настройки отображения"
        @click.stop="toggle"
      >
        <IconSettings class="h-4 w-4" />
      </button>
    </template>

    <template #default>
      <label
        class="flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm text-fg transition hover:bg-hover-bg"
      >
        <input v-model="showSource" type="checkbox" class="h-4 w-4 cursor-pointer accent-active" />
        <span>Показать источник</span>
      </label>

      <label
        class="flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm text-fg transition hover:bg-hover-bg"
      >
        <input v-model="showFiles" type="checkbox" class="h-4 w-4 cursor-pointer accent-active" />
        <span>Показать файлы</span>
      </label>
    </template>
  </DropdownMenu>
</template>
