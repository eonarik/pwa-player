<!-- src/components/library/FolderSettingsMenu.vue -->
<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useUiSettingsStore } from '@/stores/uiSettings'
import DropdownMenu from '@/components/ui/DropdownMenu.vue'
import Checkbox from '@/components/ui/Checkbox.vue'
import IconButton from '@/components/ui/IconButton.vue'

const uiSettings = useUiSettingsStore()
const { showSource, showFiles, autoFetchMetadata, autoDownloadTracks } = storeToRefs(uiSettings)
</script>

<template>
  <DropdownMenu :width="256">
    <template #trigger="{ toggle, setTriggerRef }">
      <div :ref="setTriggerRef">
        <IconButton icon="settings" label="Настройки отображения" @click="toggle" />
      </div>
    </template>

    <template #default>
      <div class="flex flex-col gap-1 py-1">
        <div class="px-4">
          <Checkbox v-model="showSource" label="Показать источник" />
        </div>
        <div class="px-4">
          <Checkbox v-model="autoFetchMetadata" label="Автопоиск метаданных" />
        </div>
        <div class="px-4">
          <Checkbox v-model="autoDownloadTracks" label="Автоскачивание" />
        </div>
        <div class="px-4">
          <Checkbox v-model="showFiles" label="Показать файлы" />
        </div>
      </div>
    </template>
  </DropdownMenu>
</template>
