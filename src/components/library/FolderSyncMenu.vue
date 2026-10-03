<!-- src/components/library/FolderSyncMenu.vue -->
<script setup lang="ts">
import DropdownMenu from '@/components/ui/DropdownMenu.vue'
import IconChevronDown from '@/components/icons/IconChevronDown.vue'

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

const onRefreshCloud = (close: () => void) => {
  close()
  emit('refresh-cloud')
}

const onRefreshDevice = (close: () => void) => {
  close()
  emit('refresh-device')
}
</script>

<template>
  <DropdownMenu :width="256">
    <template #trigger="{ isOpen, toggle, setTriggerRef }">
      <button :ref="setTriggerRef" type="button"
        class="flex items-center gap-1 rounded-btn bg-card-bg px-3 py-1.5 text-xs text-fg transition hover:bg-hover-bg disabled:opacity-50"
        :disabled="isRefreshing || isRefreshingFromDevice" @click.stop="toggle">
        <span v-if="isRefreshing">Обновление…</span>
        <span v-else-if="isRefreshingFromDevice">Сканирование…</span>
        <span v-else>Синхронизация</span>
        <IconChevronDown class="h-3 w-3 transition" :class="isOpen ? 'rotate-180' : ''" />
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
