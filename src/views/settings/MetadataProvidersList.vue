<!-- src/views/settings/MetadataProvidersList.vue -->

<script setup lang="ts">
import { computed } from 'vue';
import { VueDraggable } from 'vue-draggable-plus';
import { storeToRefs } from 'pinia';
import { useUiSettingsStore } from '@/stores/uiSettings';
import { getPlugins } from '@/plugins/registry';
import { getPluginName } from '@/plugins/lookup';
import { BUILTIN_METADATA_PROVIDERS } from '@/services/metadata/MetadataService/constants';
import Icon from '@/components/ui/Icon.vue';
import IconButton from '@/components/ui/IconButton.vue';
import Checkbox from '@/components/ui/Checkbox.vue';

interface ProviderRow {
  id: string;
  label: string;
  enabled: boolean;
}

const uiSettings = useUiSettingsStore();
const { metadataProviderOrder } = storeToRefs(uiSettings);

/**
 * Полный список провайдеров:
 * - built-in (itunes, deezer);
 * - плагины с manifest.metadataPriority !== undefined.
 */
const allProviders = computed<{ id: string; label: string }[]>(() => {
  const builtin = BUILTIN_METADATA_PROVIDERS.map((id) => ({
    id,
    label: id === 'itunes' ? 'iTunes' : 'Deezer',
  }));

  const plugins = getPlugins()
    .filter((m) => m.metadataPriority !== undefined)
    .map((m) => ({
      id: m.id,
      label: getPluginName(m.id, m.name),
    }));

  return [...builtin, ...plugins];
});

/**
 * Включённые провайдеры в порядке metadataProviderOrder.
 * Плюс фильтруем «мёртвые» id (плагин удалён / отключён / потерял metadataPriority).
 */
const enabledRows = computed<ProviderRow[]>(() => {
  const available = new Map(allProviders.value.map((p) => [p.id, p]));
  const result: ProviderRow[] = [];
  for (const id of metadataProviderOrder.value) {
    const p = available.get(id);
    if (!p) continue;
    result.push({ ...p, enabled: true });
  }
  return result;
});

/**
 * Выключенные провайдеры (есть в allProviders, нет в metadataProviderOrder).
 */
const disabledRows = computed<ProviderRow[]>(() => {
  const inOrder = new Set(metadataProviderOrder.value);
  return allProviders.value.filter((p) => !inOrder.has(p.id)).map((p) => ({ ...p, enabled: false }));
});

/**
 * Модель для VueDraggable: массив id включённых провайдеров.
 * При drag-and-drop set обновляет uiSettings.setMetadataProviderOrder.
 */
const draggableModel = computed<string[]>({
  get: () => enabledRows.value.map((r) => r.id),
  set: (next) => uiSettings.setMetadataProviderOrder(next),
});

function onToggle(id: string, enabled: boolean): void {
  uiSettings.toggleMetadataProvider(id, enabled);
}

function moveUp(index: number): void {
  const arr = [...metadataProviderOrder.value];
  if (index <= 0 || index >= arr.length) return;
  const [item] = arr.splice(index, 1);
  arr.splice(index - 1, 0, item!);
  uiSettings.setMetadataProviderOrder(arr);
}

function moveDown(index: number): void {
  const arr = [...metadataProviderOrder.value];
  if (index < 0 || index >= arr.length - 1) return;
  const [item] = arr.splice(index, 1);
  arr.splice(index + 1, 0, item!);
  uiSettings.setMetadataProviderOrder(arr);
}

function providerLabel(id: string): string {
  const found = allProviders.value.find((p) => p.id === id);
  return found?.label ?? id;
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <p class="text-xs text-fg-muted px-1">
      Порядок поиска метаданных (обложки, альбомы, теги). Если ни один не включён — автопоиск отключён.
    </p>

    <!-- Включённые (drag-and-drop) -->
    <VueDraggable
      v-if="draggableModel.length > 0"
      v-model="draggableModel"
      :animation="150"
      handle=".drag-handle"
      class="flex flex-col gap-1"
    >
      <div
        v-for="(id, index) in draggableModel"
        :key="id"
        class="flex items-center gap-2 bg-card-bg px-3 py-2 rounded-btn"
      >
        <button
          type="button"
          class="drag-handle cursor-grab active:cursor-grabbing text-fg-subtle hover:text-fg p-1"
          aria-label="Перетащить"
        >
          <Icon name="menu" w="w-4" h="h-4" />
        </button>

        <Checkbox
          :model-value="true"
          :label="providerLabel(id)"
          @update:model-value="(v: boolean) => onToggle(id, v)"
        />

        <div class="ml-auto flex items-center gap-0.5">
          <IconButton
            icon="arrow-up"
            variant="ghost"
            size="sm"
            label="Вверх"
            :disabled="index === 0"
            @click="moveUp(index)"
          />
          <IconButton
            icon="arrow-down"
            variant="ghost"
            size="sm"
            label="Вниз"
            :disabled="index === draggableModel.length - 1"
            @click="moveDown(index)"
          />
        </div>
      </div>
    </VueDraggable>

    <div v-else class="bg-card-bg px-3 py-3 rounded-btn text-xs text-fg-muted text-center">
      Все источники метаданных выключены. Автопоиск отключён.
    </div>

    <!-- Выключенные -->
    <div v-if="disabledRows.length > 0" class="flex flex-col gap-1 mt-2">
      <p class="text-[10px] font-medium uppercase tracking-wider text-fg-subtle px-1 mt-1">Выключены</p>
      <div
        v-for="row in disabledRows"
        :key="row.id"
        class="flex items-center gap-2 bg-card-bg/50 px-3 py-2 rounded-btn opacity-70"
      >
        <div class="w-6" />
        <Checkbox :model-value="false" :label="row.label" @update:model-value="(v: boolean) => onToggle(row.id, v)" />
      </div>
    </div>
  </div>
</template>
