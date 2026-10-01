<!-- src/components/library/FolderSettingsMenu.vue -->
<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useMenu } from '@/composables/useMenu'
import { useUiSettingsStore } from '@/stores/uiSettings'

const uiSettings = useUiSettingsStore()
const { showSource, showFiles } = storeToRefs(uiSettings)

const { isOpen, rootRef, toggle } = useMenu()
</script>

<template>
  <div ref="rootRef" class="relative">
    <button type="button"
      class="flex h-8 w-8 items-center justify-center rounded-btn bg-card-bg text-fg transition hover:bg-hover-bg"
      aria-label="Настройки отображения" title="Настройки отображения" @click.stop="toggle">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
        stroke-linejoin="round" class="h-4 w-4">
        <circle cx="12" cy="12" r="3" />
        <path
          d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    </button>

    <div v-if="isOpen" class="absolute right-0 top-full z-20 mt-1 w-56 overflow-hidden bg-bg-elevated shadow-lg">
      <label class="flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm text-fg transition hover:bg-hover-bg">
        <input v-model="showSource" type="checkbox" class="h-4 w-4 cursor-pointer accent-active" />
        <span>Показать источник</span>
      </label>

      <label class="flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm text-fg transition hover:bg-hover-bg">
        <input v-model="showFiles" type="checkbox" class="h-4 w-4 cursor-pointer accent-active" />
        <span>Показать файлы</span>
      </label>
    </div>
  </div>
</template>
