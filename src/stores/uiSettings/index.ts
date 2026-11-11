// src/stores/uiSettings/index.ts

import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import {
  defaultProviderOrder,
  readFromStorage,
  sanitizeProviderOrder,
  writeToStorage,
  DEFAULT_METADATA_THRESHOLD,
  DEFAULT_PLAYLIST_MATCH_THRESHOLD,
  DEFAULT_SEARCH_THRESHOLD,
  type PersistedUiSettings,
} from './schema';

const SAVE_DEBOUNCE_MS = 300;

/**
 * Пользовательские настройки UI. Схема хранения, миграции и санитайзеры —
 * в `./schema`; здесь только реактивное состояние и API стора.
 */
export const useUiSettingsStore = defineStore('uiSettings', () => {
  const showSource = ref(false);
  const showFiles = ref(false);
  const metadataThreshold = ref(DEFAULT_METADATA_THRESHOLD);
  const searchThreshold = ref(DEFAULT_SEARCH_THRESHOLD);
  const playlistMatchThreshold = ref(DEFAULT_PLAYLIST_MATCH_THRESHOLD);
  const autoFetchMetadata = ref(true);
  const autoDownloadTracks = ref(false);
  const metadataProviderOrder = ref<string[]>(defaultProviderOrder());
  const metadataProviderEnabled = ref<Record<string, boolean>>({});

  let isLoaded = false;
  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  function load(): void {
    if (isLoaded) return;
    const data = readFromStorage();
    if (data) {
      showSource.value = data.showSource;
      showFiles.value = data.showFiles;
      metadataThreshold.value = data.metadataThreshold;
      searchThreshold.value = data.searchThreshold;
      playlistMatchThreshold.value = data.playlistMatchThreshold;
      autoFetchMetadata.value = data.autoFetchMetadata;
      autoDownloadTracks.value = data.autoDownloadTracks;
      metadataProviderOrder.value = data.metadataProviderOrder;
      metadataProviderEnabled.value = data.metadataProviderEnabled;
    }
    isLoaded = true;
  }

  function snapshot(): PersistedUiSettings {
    return {
      showSource: showSource.value,
      showFiles: showFiles.value,
      metadataThreshold: metadataThreshold.value,
      searchThreshold: searchThreshold.value,
      playlistMatchThreshold: playlistMatchThreshold.value,
      autoFetchMetadata: autoFetchMetadata.value,
      autoDownloadTracks: autoDownloadTracks.value,
      metadataProviderOrder: metadataProviderOrder.value,
      metadataProviderEnabled: metadataProviderEnabled.value,
    };
  }

  function persistNow(): void {
    if (!isLoaded) return;
    writeToStorage(snapshot());
  }

  function save(): void {
    if (!isLoaded) return;
    if (saveTimer !== null) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      persistNow();
    }, SAVE_DEBOUNCE_MS);
  }

  function flush(): void {
    if (saveTimer !== null) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    persistNow();
  }

  watch(
    [
      showSource,
      showFiles,
      metadataThreshold,
      searchThreshold,
      playlistMatchThreshold,
      autoFetchMetadata,
      autoDownloadTracks,
      metadataProviderOrder,
      metadataProviderEnabled,
    ],
    () => {
      save();
    },
    { deep: true },
  );

  function toggleShowSource(): void {
    showSource.value = !showSource.value;
  }

  /** Пороги сравнения вне [0, 1] бессмысленны — зажимаем. */
  function clampThreshold(value: number): number {
    return Math.min(Math.max(value, 0), 1);
  }

  function setMetadataThreshold(value: number): void {
    metadataThreshold.value = clampThreshold(value);
  }

  function setSearchThreshold(value: number): void {
    searchThreshold.value = clampThreshold(value);
  }

  function setPlaylistMatchThreshold(value: number): void {
    playlistMatchThreshold.value = clampThreshold(value);
  }

  function setMetadataProviderOrder(order: string[]): void {
    metadataProviderOrder.value = sanitizeProviderOrder(order) ?? [];
  }

  /**
   * Проверяет, включён ли провайдер.
   * По умолчанию (нет ключа в `metadataProviderEnabled`) — включён.
   * Чтобы исключить несуществующие id (удалённые плагины), используем
   * отдельную проверку в `resolve`.
   */
  function isMetadataProviderEnabled(id: string): boolean {
    return metadataProviderEnabled.value[id] !== false;
  }

  function toggleMetadataProvider(id: string, enabled: boolean): void {
    if (enabled) {
      // Удаляем ключ — значит "включён по умолчанию".
      const next = { ...metadataProviderEnabled.value };
      delete next[id];
      metadataProviderEnabled.value = next;
    } else {
      metadataProviderEnabled.value = {
        ...metadataProviderEnabled.value,
        [id]: false,
      };
    }
  }

  return {
    autoFetchMetadata,
    autoDownloadTracks,
    showSource,
    showFiles,
    metadataThreshold,
    searchThreshold,
    playlistMatchThreshold,
    metadataProviderOrder,
    metadataProviderEnabled,

    load,
    flush,
    toggleShowSource,
    setMetadataThreshold,
    setSearchThreshold,
    setPlaylistMatchThreshold,
    setMetadataProviderOrder,
    isMetadataProviderEnabled,
    toggleMetadataProvider,
  };
});
