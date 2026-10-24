<!-- src/components/library/FolderSyncMenu.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import DropdownMenu from '@/components/ui/DropdownMenu.vue'
import IconButton from '@/components/ui/IconButton.vue'

const props = defineProps<{
  canRefresh: boolean
  canRefreshFromDevice: boolean
  isRefreshing: boolean
  isRefreshingFromDevice: boolean
  needsAttention?: boolean
}>()

const emit = defineEmits<{
  (e: 'refresh-cloud'): void
  (e: 'refresh-device'): void
}>()

const onRefreshCloud = (close: () => void) => {
  close()
  emit('refresh-cloud')
}

const onRefreshDevice = (close: () => void) => {
  close()
  emit('refresh-device')
}

const label = computed(() => props.isRefreshing
  ? 'Обновление с облака…'
  : props.isRefreshingFromDevice
    ? 'Сканирование устройства…'
    : 'Синхронизация'
)

const isSpinning = computed(() => props.isRefreshing || props.isRefreshingFromDevice)
</script>

<template>
  <DropdownMenu :width="256">
    <template #trigger="{ toggle, setTriggerRef }">
      <div class="relative" :ref="setTriggerRef">
        <IconButton icon="refresh" :label="label" :disabled="isSpinning"
          :variant="needsAttention ? 'danger' : 'default'" :icon-class="isSpinning ? 'animate-spin' : ''"
          @click="toggle" />

        <span v-if="needsAttention"
          class="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
      </div>
    </template>

    <template #default="{ close }">
      <button v-if="canRefresh" type="button"
        class="block w-full px-4 py-2.5 text-left text-sm text-fg transition hover:bg-hover-bg"
        @click="onRefreshCloud(close)">
        Обновить с облака
        <span class="block text-[10px] text-fg-muted"> Синхронизировать треки с Яндекс.Диска </span>
      </button>

      <button v-if="canRefreshFromDevice" type="button"
        class="block w-full px-4 py-2.5 text-left text-sm text-fg transition hover:bg-hover-bg"
        @click="onRefreshDevice(close)">
        Обновить с устройства
        <span class="block text-[10px] text-fg-muted"> Найти новые и отсутствующие файлы </span>
      </button>
    </template>
  </DropdownMenu>
</template>
