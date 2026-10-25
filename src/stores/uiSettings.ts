// src/stores/uiSettings.ts

import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { get, set } from 'idb-keyval'

const UI_SETTINGS_KEY = 'player:uiSettings'
const SAVE_DEBOUNCE_MS = 300

const DEFAULT_METADATA_THRESHOLD = 0.75
const DEFAULT_SEARCH_THRESHOLD = 0.75
const DEFAULT_PLAYLIST_MATCH_THRESHOLD = 0.75

interface PersistedUiSettings {
  showSource: boolean
  showFiles: boolean
  metadataThreshold: number
  searchThreshold: number
  playlistMatchThreshold: number
  autoFetchMetadata: boolean
  autoDownloadTracks: boolean
}

export const useUiSettingsStore = defineStore('uiSettings', () => {
  const showSource = ref(false)
  const showFiles = ref(false)
  const metadataThreshold = ref(DEFAULT_METADATA_THRESHOLD)
  const searchThreshold = ref(DEFAULT_SEARCH_THRESHOLD)
  const playlistMatchThreshold = ref(DEFAULT_PLAYLIST_MATCH_THRESHOLD)
  const autoFetchMetadata = ref(true)
  const autoDownloadTracks = ref(false)

  let isLoaded = false
  let saveTimer: ReturnType<typeof setTimeout> | null = null

  async function load(): Promise<void> {
    if (isLoaded) return
    try {
      const data = await get<PersistedUiSettings>(UI_SETTINGS_KEY)
      if (data) {
        showSource.value = data.showSource ?? false
        showFiles.value = data.showFiles ?? false
        if (
          typeof data.metadataThreshold === 'number' &&
          data.metadataThreshold >= 0 &&
          data.metadataThreshold <= 1
        ) {
          metadataThreshold.value = data.metadataThreshold
        }
        if (
          typeof data.searchThreshold === 'number' &&
          data.searchThreshold >= 0 &&
          data.searchThreshold <= 1
        ) {
          searchThreshold.value = data.searchThreshold
        }
        if (
          typeof data.playlistMatchThreshold === 'number' &&
          data.playlistMatchThreshold >= 0 &&
          data.playlistMatchThreshold <= 1
        ) {
          playlistMatchThreshold.value = data.playlistMatchThreshold
        }
        autoFetchMetadata.value = data.autoFetchMetadata ?? true
        autoDownloadTracks.value = data.autoDownloadTracks ?? false
      }
      isLoaded = true
    } catch (err) {
      console.error('[uiSettings] failed to load', err)
    }
  }

  async function persistNow(): Promise<void> {
    if (!isLoaded) return
    try {
      await set(UI_SETTINGS_KEY, {
        showSource: showSource.value,
        showFiles: showFiles.value,
        metadataThreshold: metadataThreshold.value,
        searchThreshold: searchThreshold.value,
        playlistMatchThreshold: playlistMatchThreshold.value,
        autoFetchMetadata: autoFetchMetadata.value,
        autoDownloadTracks: autoDownloadTracks.value,
      })
    } catch (err) {
      console.error('[uiSettings] failed to save', err)
    }
  }

  function save(): void {
    if (!isLoaded) return
    if (saveTimer !== null) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      saveTimer = null
      void persistNow()
    }, SAVE_DEBOUNCE_MS)
  }

  async function flush(): Promise<void> {
    if (saveTimer !== null) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    await persistNow()
  }

  watch([showSource, showFiles, metadataThreshold, searchThreshold, playlistMatchThreshold, autoFetchMetadata, autoDownloadTracks], () => {
    save()
  })

  function toggleShowSource(): void {
    showSource.value = !showSource.value
  }

  function setMetadataThreshold(value: number): void {
    metadataThreshold.value = Math.min(Math.max(value, 0), 1)
  }

  function setSearchThreshold(value: number): void {
    searchThreshold.value = Math.min(Math.max(value, 0), 1)
  }

  function setPlaylistMatchThreshold(value: number): void {
    playlistMatchThreshold.value = Math.min(Math.max(value, 0), 1)
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
  }
})
