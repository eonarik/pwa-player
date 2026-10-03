<!-- src/components/ui/ShowSourceCheckbox.vue -->
<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useUiSettingsStore } from '@/stores/uiSettings'

const uiSettings = useUiSettingsStore()
const { showSource } = storeToRefs(uiSettings)
</script>

<template>
  <label
    class="flex cursor-pointer items-center gap-2 text-xs text-fg-muted transition hover:text-fg"
  >
    <input v-model="showSource" type="checkbox" class="h-3.5 w-3.5 cursor-pointer accent-active" />
    <span>Показать источник</span>
  </label>
</template>
