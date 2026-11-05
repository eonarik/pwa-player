// src/stores/uiSettings.ts

import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { BUILTIN_METADATA_PROVIDERS } from '@/services/metadata/MetadataService/constants';
import { consumeLegacyMetadataToggle } from '@/services/metadata/MetadataService/migrations';
import { getPlugins } from '@/plugins/registry';

const UI_SETTINGS_KEY = 'player:uiSettings';
const SAVE_DEBOUNCE_MS = 300;

const DEFAULT_METADATA_THRESHOLD = 0.75;
const DEFAULT_SEARCH_THRESHOLD = 0.75;
const DEFAULT_PLAYLIST_MATCH_THRESHOLD = 0.75;

interface PersistedUiSettings {
  showSource: boolean;
  showFiles: boolean;
  metadataThreshold: number;
  searchThreshold: number;
  playlistMatchThreshold: number;
  autoFetchMetadata: boolean;
  autoDownloadTracks: boolean;
  metadataProviderOrder: string[];
  metadataProviderEnabled: Record<string, boolean>;
}

function isValidThreshold(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function sanitizeProviderOrder(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const result: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    if (seen.has(item)) continue;
    seen.add(item);
    result.push(item);
  }
  return result;
}

function sanitizeEnabled(raw: unknown): Record<string, boolean> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const result: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'boolean') result[key] = value;
  }
  return result;
}

/**
 * Дефолтный порядок ВСЕХ провайдеров (включённых и выключенных):
 * 1. Built-in (itunes, deezer).
 * 2. Плагины с manifest.metadataPriority (по возрастанию).
 */
function defaultProviderOrder(): string[] {
  const order: string[] = [...BUILTIN_METADATA_PROVIDERS];

  try {
    const pluginProviders = getPlugins()
      .filter((m) => m.metadataPriority !== undefined)
      .sort((a, b) => (a.metadataPriority ?? 0) - (b.metadataPriority ?? 0))
      .map((m) => m.id);

    for (const id of pluginProviders) {
      if (!order.includes(id)) order.push(id);
    }
  } catch {
    // Fallback — только built-in.
  }

  return order;
}

function defaultValues(): PersistedUiSettings {
  return {
    showSource: false,
    showFiles: false,
    metadataThreshold: DEFAULT_METADATA_THRESHOLD,
    searchThreshold: DEFAULT_SEARCH_THRESHOLD,
    playlistMatchThreshold: DEFAULT_PLAYLIST_MATCH_THRESHOLD,
    autoFetchMetadata: true,
    autoDownloadTracks: false,
    metadataProviderOrder: defaultProviderOrder(),
    metadataProviderEnabled: {},
  };
}

function readFromStorage(): PersistedUiSettings | null {
  const legacy = consumeLegacyMetadataToggle();

  let raw: string | null = null;
  try {
    raw = localStorage.getItem(UI_SETTINGS_KEY);
  } catch (err) {
    console.warn('[uiSettings] failed to read from localStorage', err);
    return null;
  }

  if (!raw) {
    const base = defaultValues();
    if (legacy === 'disabled-all-plugins') {
      const enabled: Record<string, boolean> = {};
      for (const id of base.metadataProviderOrder) enabled[id] = false;
      base.metadataProviderEnabled = enabled;
    }
    return base;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PersistedUiSettings>;
    if (!parsed || typeof parsed !== 'object') return null;

    let metadataProviderOrder = sanitizeProviderOrder(parsed.metadataProviderOrder);
    if (metadataProviderOrder === null) {
      metadataProviderOrder = defaultProviderOrder();
    } else {
      // Миграция старого формата: order содержал только включённые.
      // Добавляем недостающие (built-in + плагины) в конец.
      const defaults = defaultProviderOrder();
      const seen = new Set(metadataProviderOrder);
      for (const id of defaults) {
        if (!seen.has(id)) {
          metadataProviderOrder.push(id);
          seen.add(id);
        }
      }
    }

    let metadataProviderEnabled = sanitizeEnabled(parsed.metadataProviderEnabled);
    if (metadataProviderEnabled === null) {
      if (legacy === 'disabled-all-plugins') {
        metadataProviderEnabled = {};
        for (const id of metadataProviderOrder) metadataProviderEnabled[id] = false;
      } else {
        metadataProviderEnabled = {};
      }
    }

    return {
      showSource: parsed.showSource ?? false,
      showFiles: parsed.showFiles ?? false,
      metadataThreshold: isValidThreshold(parsed.metadataThreshold)
        ? parsed.metadataThreshold
        : DEFAULT_METADATA_THRESHOLD,
      searchThreshold: isValidThreshold(parsed.searchThreshold) ? parsed.searchThreshold : DEFAULT_SEARCH_THRESHOLD,
      playlistMatchThreshold: isValidThreshold(parsed.playlistMatchThreshold)
        ? parsed.playlistMatchThreshold
        : DEFAULT_PLAYLIST_MATCH_THRESHOLD,
      autoFetchMetadata: parsed.autoFetchMetadata ?? true,
      autoDownloadTracks: parsed.autoDownloadTracks ?? false,
      metadataProviderOrder,
      metadataProviderEnabled,
    };
  } catch (err) {
    console.warn('[uiSettings] failed to read from localStorage', err);
    return null;
  }
}

function writeToStorage(data: PersistedUiSettings): void {
  try {
    localStorage.setItem(UI_SETTINGS_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('[uiSettings] failed to save to localStorage', err);
  }
}

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

  function persistNow(): void {
    if (!isLoaded) return;
    writeToStorage({
      showSource: showSource.value,
      showFiles: showFiles.value,
      metadataThreshold: metadataThreshold.value,
      searchThreshold: searchThreshold.value,
      playlistMatchThreshold: playlistMatchThreshold.value,
      autoFetchMetadata: autoFetchMetadata.value,
      autoDownloadTracks: autoDownloadTracks.value,
      metadataProviderOrder: metadataProviderOrder.value,
      metadataProviderEnabled: metadataProviderEnabled.value,
    });
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

  function setMetadataThreshold(value: number): void {
    metadataThreshold.value = Math.min(Math.max(value, 0), 1);
  }

  function setSearchThreshold(value: number): void {
    searchThreshold.value = Math.min(Math.max(value, 0), 1);
  }

  function setPlaylistMatchThreshold(value: number): void {
    playlistMatchThreshold.value = Math.min(Math.max(value, 0), 1);
  }

  function setMetadataProviderOrder(order: string[]): void {
    const sanitized = sanitizeProviderOrder(order) ?? [];
    metadataProviderOrder.value = sanitized;
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
