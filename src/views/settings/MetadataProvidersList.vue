<!-- src/views/settings/MetadataProvidersList.vue -->

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
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
const { metadataProviderOrder, metadataProviderEnabled } = storeToRefs(uiSettings);

const allProviders = computed<{ id: string; label: string }[]>(() => {
  const builtin = BUILTIN_METADATA_PROVIDERS.map((id) => ({
    id,
    label: id === 'itunes' ? 'iTunes' : 'Deezer',
  }));

  const plugins = getPlugins()
    .filter((m) => m.metadataPriority !== undefined)
    .sort((a, b) => (a.metadataPriority ?? 0) - (b.metadataPriority ?? 0))
    .map((m) => ({
      id: m.id,
      label: getPluginName(m.id, m.name),
    }));

  return [...builtin, ...plugins];
});

/** Локальная модель для drag-and-drop: полный порядок всех id. */
const orderedIds = ref<string[]>([]);
let syncingFromStore = false;

// Стор → orderedIds
watch(
  metadataProviderOrder,
  (order) => {
    syncingFromStore = true;
    // Дополняем недостающие (новые плагины / удалённые) в дефолтном порядке.
    const seen = new Set(order);
    const next = [...order];
    for (const p of allProviders.value) {
      if (!seen.has(p.id)) {
        next.push(p.id);
        seen.add(p.id);
      }
    }
    orderedIds.value = next;
    void Promise.resolve().then(() => {
      syncingFromStore = false;
    });
  },
  { immediate: true },
);

// orderedIds → стор
watch(
  orderedIds,
  (next) => {
    if (syncingFromStore) return;
    uiSettings.setMetadataProviderOrder(next);
  },
  { deep: true },
);

const rows = computed<ProviderRow[]>(() => {
  const available = new Map(allProviders.value.map((p) => [p.id, p]));
  const result: ProviderRow[] = [];
  for (const id of orderedIds.value) {
    const p = available.get(id);
    if (!p) continue;
    result.push({
      ...p,
      enabled: metadataProviderEnabled.value[id] !== false,
    });
  }
  return result;
});

const enabledCount = computed(() => rows.value.filter((r) => r.enabled).length);

function onToggle(id: string, enabled: boolean): void {
  uiSettings.toggleMetadataProvider(id, enabled);
}

function moveUp(index: number): void {
  const arr = [...orderedIds.value];
  if (index <= 0 || index >= arr.length) return;
  const [item] = arr.splice(index, 1);
  arr.splice(index - 1, 0, item!);
  orderedIds.value = arr;
}

function moveDown(index: number): void {
  const arr = [...orderedIds.value];
  if (index < 0 || index >= arr.length - 1) return;
  const [item] = arr.splice(index, 1);
  arr.splice(index + 1, 0, item!);
  orderedIds.value = arr;
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <p class="text-xs text-fg-muted px-1">
      Порядок поиска метаданных (обложки, альбомы, теги). Если ни один не включён — автопоиск отключён.
    </p>

    <VueDraggable
      v-if="rows.length > 0"
      v-model="orderedIds"
      :animation="150"
      handle=".drag-handle"
      class="flex flex-col gap-1"
    >
      <div
        v-for="(row, index) in rows"
        :key="row.id"
        class="flex items-center gap-2 bg-card-bg px-3 py-2 rounded-btn transition"
        :class="row.enabled ? '' : 'opacity-60'"
      >
        <button
          type="button"
          class="drag-handle cursor-grab active:cursor-grabbing text-fg-subtle hover:text-fg p-1 touch-none"
          aria-label="Перетащить"
        >
          <Icon name="menu" w="w-4" h="h-4" />
        </button>

        <Checkbox
          :model-value="row.enabled"
          :label="row.label"
          @update:model-value="(v: boolean) => onToggle(row.id, v)"
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
            :disabled="index === rows.length - 1"
            @click="moveDown(index)"
          />
        </div>
      </div>
    </VueDraggable>

    <div v-if="rows.length === 0" class="bg-card-bg px-3 py-3 rounded-btn text-xs text-fg-muted text-center">
      Нет доступных источников метаданных.
    </div>

    <p v-if="enabledCount === 0" class="text-xs text-amber-400 px-1">Все источники выключены. Автопоиск отключён.</p>
  </div>
</template>
