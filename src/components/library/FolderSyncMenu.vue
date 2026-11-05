<!-- src/components/library/FolderSyncMenu.vue -->

<script setup lang="ts">
import { computed } from 'vue';
import DropdownMenu from '@/components/ui/DropdownMenu.vue';
import IconButton from '@/components/ui/IconButton.vue';

const props = defineProps<{
  canRefresh: boolean;
  canRefreshFromDevice: boolean;
  isRefreshing: boolean;
  isRefreshingFromDevice: boolean;
  isShallowRefreshing: boolean;
  needsAttention?: boolean;
  hasBackgroundScan?: boolean;
  isScanning?: boolean;
}>();

const emit = defineEmits<{
  (e: 'refresh-cloud'): void;
  (e: 'refresh-cloud-shallow'): void;
  (e: 'refresh-device'): void;
  (e: 'cancel-background-scan'): void;
}>();

const isScanning = computed(() => Boolean(props.isScanning) || Boolean(props.isRefreshing));

const onRefreshCloud = (close: () => void) => {
  if (cloudDisabled.value) return;
  close();
  emit('refresh-cloud');
};

const onRefreshCloudShallow = (close: () => void) => {
  if (cloudShallowDisabled.value) return;
  close();
  emit('refresh-cloud-shallow');
};

const onRefreshDevice = (close: () => void) => {
  if (deviceDisabled.value) return;
  close();
  emit('refresh-device');
};

const onCancelScan = (close: () => void) => {
  close();
  emit('cancel-background-scan');
};

const isSpinning = computed(
  () =>
    props.isRefreshing ||
    props.isRefreshingFromDevice ||
    props.isShallowRefreshing ||
    props.hasBackgroundScan ||
    isScanning.value,
);

const label = computed(() => (isSpinning.value ? 'Синхронизация...' : 'Синхронизация'));

const cloudDisabled = computed(() => isScanning.value);
const cloudShallowDisabled = computed(() => isScanning.value || props.isShallowRefreshing);
const deviceDisabled = computed(() => isScanning.value || Boolean(props.isRefreshingFromDevice));
</script>

<template>
  <DropdownMenu :width="280">
    <template #trigger="{ toggle, setTriggerRef }">
      <div class="relative" :ref="setTriggerRef">
        <IconButton
          icon="refresh"
          :label="label"
          :variant="needsAttention ? 'danger' : 'default'"
          :icon-class="isSpinning ? 'animate-spin' : ''"
          @click="toggle"
        />

        <span
          v-if="needsAttention"
          class="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse"
        />
      </div>
    </template>

    <template #default="{ close }">
      <button
        v-if="canRefresh"
        type="button"
        class="block w-full px-4 py-2.5 text-left text-sm text-fg transition hover:bg-hover-bg disabled:opacity-50 disabled:cursor-not-allowed"
        :disabled="cloudDisabled"
        @click="onRefreshCloud(close)"
      >
        Обновить с облака
        <span class="block text-[10px] text-fg-muted"> Пересканировать всё поддерево с удалением </span>
      </button>

      <button
        v-if="canRefresh"
        type="button"
        class="block w-full px-4 py-2.5 text-left text-sm text-fg transition hover:bg-hover-bg disabled:opacity-50 disabled:cursor-not-allowed"
        :disabled="cloudShallowDisabled"
        @click="onRefreshCloudShallow(close)"
      >
        Досканировать
        <span class="block text-[10px] text-fg-muted"> Только текущая папка: добавить новые, убрать пропавшие </span>
      </button>

      <button
        v-if="canRefreshFromDevice"
        type="button"
        class="block w-full px-4 py-2.5 text-left text-sm text-fg transition hover:bg-hover-bg disabled:opacity-50 disabled:cursor-not-allowed"
        :disabled="deviceDisabled"
        @click="onRefreshDevice(close)"
      >
        Обновить с устройства
        <span class="block text-[10px] text-fg-muted"> Найти новые и отсутствующие файлы </span>
      </button>

      <div v-if="hasBackgroundScan || isScanning" class="border-t border-hover-bg mt-1 pt-1">
        <button
          type="button"
          class="block w-full px-4 py-2.5 text-left text-sm text-red-400 transition hover:bg-red-500/10"
          @click="onCancelScan(close)"
        >
          Отменить синхронизацию
          <span class="block text-[10px] text-red-400/70"> Остановить фоновый скан </span>
        </button>
      </div>
    </template>
  </DropdownMenu>
</template>
