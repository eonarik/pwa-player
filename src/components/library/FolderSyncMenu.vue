<!-- src/components/library/FolderSyncMenu.vue -->
<script setup lang="ts">
import { useMenu } from '@/composables/useMenu'

defineProps<{
  canRefresh: boolean
  canRefreshFromDevice: boolean
  isRefreshing: boolean
  isRefreshingFromDevice: boolean
}>()

const emit = defineEmits<{
  (e: 'refresh-cloud'): void
  (e: 'refresh-device'): void
}>()

const { isOpen, rootRef, toggle, close } = useMenu()

function onCloud() {
  emit('refresh-cloud')
  close()
}

function onDevice() {
  emit('refresh-device')
  close()
}
</script>

<template>
  <div ref="rootRef" class="relative">
    <button type="button"
      class="flex items-center gap-1 rounded-btn bg-card-bg px-3 py-1.5 text-xs text-fg transition hover:bg-hover-bg disabled:opacity-50"
      :disabled="isRefreshing || isRefreshingFromDevice" @click.stop="toggle">
      <span v-if="isRefreshing">Обновление…</span>
      <span v-else-if="isRefreshingFromDevice">Сканирование…</span>
      <span v-else>Синхронизация</span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-3 w-3 transition"
        :class="isOpen ? 'rotate-180' : ''">
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>

    <div v-if="isOpen" class="absolute right-0 top-full z-20 mt-1 w-64 overflow-hidden bg-bg-elevated shadow-lg">
      <button v-if="canRefresh" type="button"
        class="block w-full px-4 py-2.5 text-left text-sm text-fg transition hover:bg-hover-bg" @click="onCloud">
        Обновить с облака
        <span class="block text-[10px] text-fg-muted">
          Синхронизировать треки с Яндекс.Диска
        </span>
      </button>

      <button v-if="canRefreshFromDevice" type="button"
        class="block w-full px-4 py-2.5 text-left text-sm text-fg transition hover:bg-hover-bg" @click="onDevice">
        Обновить с устройства
        <span class="block text-[10px] text-fg-muted">
          Найти новые и отсутствующие файлы
        </span>
      </button>
    </div>
  </div>
</template>
