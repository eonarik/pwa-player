// src/stores/uiSettings.ts

import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

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
}

function readFromStorage(): PersistedUiSettings | null {
  try {
    const raw = localStorage.getItem(UI_SETTINGS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedUiSettings>;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      showSource: parsed.showSource ?? false,
      showFiles: parsed.showFiles ?? false,
      metadataThreshold:
        typeof parsed.metadataThreshold === 'number' && parsed.metadataThreshold >= 0 && parsed.metadataThreshold <= 1
          ? parsed.metadataThreshold
          : DEFAULT_METADATA_THRESHOLD,
      searchThreshold:
        typeof parsed.searchThreshold === 'number' && parsed.searchThreshold >= 0 && parsed.searchThreshold <= 1
          ? parsed.searchThreshold
          : DEFAULT_SEARCH_THRESHOLD,
      playlistMatchThreshold:
        typeof parsed.playlistMatchThreshold === 'number' &&
        parsed.playlistMatchThreshold >= 0 &&
        parsed.playlistMatchThreshold <= 1
          ? parsed.playlistMatchThreshold
          : DEFAULT_PLAYLIST_MATCH_THRESHOLD,
      autoFetchMetadata: parsed.autoFetchMetadata ?? true,
      autoDownloadTracks: parsed.autoDownloadTracks ?? false,
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
    ],
    () => {
      save();
    },
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

  return {
    autoFetchMetadata,
    autoDownloadTracks,
    showSource,
    showFiles,
    metadataThreshold,
    searchThreshold,
    playlistMatchThreshold,

    load,
    flush,
    toggleShowSource,
    setMetadataThreshold,
    setSearchThreshold,
    setPlaylistMatchThreshold,
  };
});
