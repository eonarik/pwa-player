<!-- src/components/library/FolderSyncMenu.vue -->
<script setup lang="ts">
import { computed } from "vue";
import DropdownMenu from '@/components/ui/DropdownMenu.vue'
import IconRefresh from '@/components/icons/IconRefresh.vue'

const props = defineProps<{
  canRefresh: boolean
  canRefreshFromDevice: boolean
  isRefreshing: boolean
  isRefreshingFromDevice: boolean
  needsAttention?: boolean // <-- Добавлено
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

</script>

<template>
  <DropdownMenu :width="256">
    <template #trigger="{ toggle, setTriggerRef }">
      <button :ref="setTriggerRef" type="button"
        class="relative flex h-8 w-8 items-center justify-center rounded-btn bg-card-bg text-fg transition hover:bg-hover-bg disabled:cursor-not-allowed disabled:opacity-50"
        :class="needsAttention ? 'text-red-400' : ''" :disabled="isRefreshing || isRefreshingFromDevice"
        v-tooltip="label" :aria-label="label" @click.stop="toggle">
        <IconRefresh class="h-4 w-4" :class="isRefreshing || isRefreshingFromDevice ? 'animate-spin' : ''" />

        <!-- Красная точка при ошибке -->
        <span v-if="needsAttention" class="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500 animate-pulse" />
      </button>
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
