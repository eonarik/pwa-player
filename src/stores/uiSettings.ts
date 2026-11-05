// src/stores/uiSettings.ts

import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import {
  BUILTIN_METADATA_PROVIDERS,
  BUILTIN_METADATA_PRIORITY,
  isBuiltinMetadataProvider,
} from '@/services/metadata/MetadataService/constants';
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

/**
 * Дефолтный порядок провайдеров метаданных:
 * 1. Built-in провайдеры (itunes, deezer) — всегда первыми.
 * 2. Плагины с manifest.metadataPriority — по возрастанию приоритета.
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
    // getPlugins может быть недоступен на этапе инициализации (например, в тестах).
    // Fallback — только built-in.
  }

  return order;
}

/**
 * Полный объект дефолтных настроек.
 * Используется, когда localStorage пуст (первый запуск) или не удалось прочитать.
 */
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
  };
}

function readFromStorage(): PersistedUiSettings | null {
  // Консультируемся с legacy-флагом ВСЕГДА (один раз, идемпотентно).
  // Это гарантирует, что после миграции ключ zvuk:fetchMetadata удалён,
  // и значение корректно сконвертировано, если основного ключа ещё нет.
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
      base.metadataProviderOrder = [...BUILTIN_METADATA_PROVIDERS];
    }
    return base;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PersistedUiSettings>;
    if (!parsed || typeof parsed !== 'object') return null;

    let metadataProviderOrder = sanitizeProviderOrder(parsed.metadataProviderOrder);
    if (metadataProviderOrder === null) {
      if (legacy === 'disabled-all-plugins') {
        metadataProviderOrder = [...BUILTIN_METADATA_PROVIDERS];
      } else {
        metadataProviderOrder = defaultProviderOrder();
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

  function getProviderPriority(id: string): number | null {
    if (isBuiltinMetadataProvider(id)) return BUILTIN_METADATA_PRIORITY[id];
    const manifest = getPlugins().find((m) => m.id === id);
    return manifest?.metadataPriority ?? null;
  }

  function toggleMetadataProvider(id: string, enabled: boolean): void {
    const current = metadataProviderOrder.value;
    const has = current.includes(id);

    if (enabled && !has) {
      const priority = getProviderPriority(id);
      const next = [...current];

      if (priority === null) {
        next.push(id);
      } else {
        let insertAt = next.length;
        for (let i = 0; i < next.length; i++) {
          const otherPriority = getProviderPriority(next[i]!);
          if (otherPriority !== null && otherPriority > priority) {
            insertAt = i;
            break;
          }
        }
        next.splice(insertAt, 0, id);
      }

      metadataProviderOrder.value = next;
    } else if (!enabled && has) {
      metadataProviderOrder.value = current.filter((x) => x !== id);
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

    load,
    flush,
    toggleShowSource,
    setMetadataThreshold,
    setSearchThreshold,
    setPlaylistMatchThreshold,
    setMetadataProviderOrder,
    toggleMetadataProvider,
  };
});
