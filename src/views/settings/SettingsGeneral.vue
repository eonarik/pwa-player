<!-- src/views/settings/SettingsGeneral.vue -->

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useUiSettingsStore } from '@/stores/uiSettings';
import { downloadSpaceService } from '@/services/download/DownloadSpaceService';
import { syncService } from '@/services/download/SyncService';
import { getPlugins } from '@/plugins/registry';
import { toastService } from '@/services/ui/ToastService';
import { themeService, type ThemeId } from '@/services/ui/ThemeService';
import SectionTitle from '@/components/ui/SectionTitle.vue';
import Select from '@/components/ui/Select.vue';
import Input from '@/components/ui/Input.vue';
import Checkbox from '@/components/ui/Checkbox.vue';
import Button from '@/components/ui/Button.vue';

const uiSettings = useUiSettingsStore();
const {
  showSource,
  metadataThreshold,
  searchThreshold,
  playlistMatchThreshold,
  autoFetchMetadata,
  autoDownloadTracks,
} = storeToRefs(uiSettings);

const spaceName = computed(() => downloadSpaceService.spaceName.value);
const needsPermission = computed(() => downloadSpaceService.needsPermission.value);
const hasSpace = computed(() => downloadSpaceService.hasSpace.value);

const localSearchThreshold = ref(String(searchThreshold.value));
const localMetadataThreshold = ref(String(metadataThreshold.value));
const localPlaylistThreshold = ref(String(playlistMatchThreshold.value));

watch(searchThreshold, (val) => {
  localSearchThreshold.value = String(val);
});
watch(metadataThreshold, (val) => {
  localMetadataThreshold.value = String(val);
});
watch(playlistMatchThreshold, (val) => {
  localPlaylistThreshold.value = String(val);
});

function commitSearch() {
  const v = Number(localSearchThreshold.value);
  if (!Number.isFinite(v) || v < 0 || v > 1) {
    localSearchThreshold.value = String(searchThreshold.value);
    return;
  }
  uiSettings.setSearchThreshold(v);
}

function commitMetadata() {
  const v = Number(localMetadataThreshold.value);
  if (!Number.isFinite(v) || v < 0 || v > 1) {
    localMetadataThreshold.value = String(metadataThreshold.value);
    return;
  }
  uiSettings.setMetadataThreshold(v);
}

function commitPlaylist() {
  const v = Number(localPlaylistThreshold.value);
  if (!Number.isFinite(v) || v < 0 || v > 1) {
    localPlaylistThreshold.value = String(playlistMatchThreshold.value);
    return;
  }
  uiSettings.setPlaylistMatchThreshold(v);
}

// --- Тема оформления -------------------------------------------------

const themeOptions = computed(() => themeService.available.map((t) => ({ value: t.id, label: t.label })));
const currentTheme = computed({
  get: () => themeService.current.value,
  set: (val: string) => themeService.apply(val as ThemeId),
});

// --- Папка скачивания ------------------------------------------------

const isPickingSpace = ref(false);

async function pickSpace(): Promise<void> {
  if (isPickingSpace.value) return;
  isPickingSpace.value = true;
  try {
    const handle = await downloadSpaceService.pickSpace();
    if (handle) {
      toastService.success('Папка скачивания выбрана');

      // Запускаем сканирование для всех плагинов с canDownload
      const plugins = getPlugins().filter((p) => p.canDownload);
      for (const p of plugins) {
        void syncService.scanPlugin(p.id);
      }
    }
  } finally {
    isPickingSpace.value = false;
  }
}

async function restoreAccess(): Promise<void> {
  const state = await downloadSpaceService.requestAccess();
  if (state === 'granted') {
    toastService.success('Доступ восстановлен');
    // Тоже запускаем скан, чтобы обновить fileLocation
    const plugins = getPlugins().filter((p) => p.canDownload);
    for (const p of plugins) {
      void syncService.scanPlugin(p.id);
    }
  } else {
    toastService.error('Доступ отклонён');
  }
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <section>
      <SectionTitle text="Тема оформления" />
      <div class="flex items-center justify-between gap-4 bg-card-bg px-4 py-3">
        <div class="min-w-0">
          <p class="text-sm text-fg">Цветовая схема</p>
          <p class="text-xs text-fg-muted">Тёмная, ретро-радио или киберпанк</p>
        </div>
        <Select v-model="currentTheme" :options="themeOptions" />
      </div>
    </section>

    <section>
      <SectionTitle text="Поиск" />
      <div class="flex items-center justify-between gap-4 bg-card-bg px-4 py-3">
        <div class="min-w-0">
          <p class="text-sm text-fg">Порог совпадения</p>
          <p class="text-xs text-fg-muted">Чем выше, тем строже поиск</p>
        </div>
        <div class="shrink-0 w-20">
          <Input
            v-model="localSearchThreshold"
            type="number"
            class="text-right"
            @blur="commitSearch"
            @keydown.enter="commitSearch"
          />
        </div>
      </div>
    </section>

    <section>
      <SectionTitle text="Метаданные" />
      <div class="flex items-center justify-between gap-4 bg-card-bg px-4 py-3">
        <div class="min-w-0">
          <p class="text-sm text-fg">Порог совпадения</p>
          <p class="text-xs text-fg-muted">Ниже порога — трек в «Проблемные»</p>
        </div>
        <div class="shrink-0 w-20">
          <Input
            v-model="localMetadataThreshold"
            type="number"
            class="text-right"
            @blur="commitMetadata"
            @keydown.enter="commitMetadata"
          />
        </div>
      </div>

      <div class="bg-card-bg px-4 py-3">
        <Checkbox
          v-model="autoFetchMetadata"
          label="Автопоиск при воспроизведении"
          description="Искать обложку и теги в фоне при старте трека"
        />
      </div>
    </section>

    <section>
      <SectionTitle text="Импорт плейлистов" />
      <div class="flex items-center justify-between gap-4 bg-card-bg px-4 py-3">
        <div class="min-w-0">
          <p class="text-sm text-fg">Порог совпадения</p>
          <p class="text-xs text-fg-muted">Насколько строго искать треки при импорте</p>
        </div>
        <div class="shrink-0 w-20">
          <Input
            v-model="localPlaylistThreshold"
            type="number"
            class="text-right"
            @blur="commitPlaylist"
            @keydown.enter="commitPlaylist"
          />
        </div>
      </div>
    </section>

    <section>
      <SectionTitle text="Отображение" />
      <div class="bg-card-bg px-4 py-3">
        <Checkbox v-model="showSource" label="Показывать источник" description="Путь к папке в списках треков" />
      </div>
    </section>

    <section>
      <SectionTitle text="Скачивание" />

      <div class="bg-card-bg px-4 py-3 mb-2">
        <Checkbox
          v-model="autoDownloadTracks"
          label="Автоскачивание при воспроизведении"
          description="Автоматически скачивать треки из облака при их запуске (для офлайн-доступа)"
        />
      </div>

      <div class="flex flex-col gap-2 bg-card-bg px-4 py-3">
        <div class="flex items-center justify-between gap-4">
          <div class="min-w-0">
            <p class="text-sm text-fg">
              <template v-if="hasSpace">{{ spaceName ?? 'Папка выбрана' }}</template>
              <template v-else>Папка не выбрана</template>
            </p>
            <p v-if="needsPermission" class="text-xs text-amber-400">Требуется подтвердить доступ</p>
            <p v-else-if="hasSpace" class="text-xs text-fg-muted">Доступ есть</p>
            <p v-else class="text-xs text-fg-muted">Для скачивания треков</p>
          </div>
          <Button v-if="needsPermission" variant="primary" size="sm" class="shrink-0" @click="restoreAccess">
            Восстановить
          </Button>
          <Button v-else variant="secondary" size="sm" class="shrink-0" :disabled="isPickingSpace" @click="pickSpace">
            {{ isPickingSpace ? '…' : hasSpace ? 'Сменить' : 'Выбрать' }}
          </Button>
        </div>
      </div>
    </section>
  </div>
</template>
