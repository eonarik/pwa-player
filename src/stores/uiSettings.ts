// src/stores/uiSettings.ts

import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { get, set } from 'idb-keyval'

const UI_SETTINGS_KEY = 'player:uiSettings'

const DEFAULT_METADATA_THRESHOLD = 0.5

interface PersistedUiSettings {
  showSource: boolean
  metadataThreshold: number
}

export const useUiSettingsStore = defineStore('uiSettings', () => {
  const showSource = ref(false)
  const metadataThreshold = ref(DEFAULT_METADATA_THRESHOLD)

  let isLoaded = false

  async function load(): Promise<void> {
    if (isLoaded) return
    try {
      const data = await get<PersistedUiSettings>(UI_SETTINGS_KEY)
      if (data) {
        showSource.value = data.showSource ?? false
        if (
          typeof data.metadataThreshold === 'number' &&
          data.metadataThreshold >= 0 &&
          data.metadataThreshold <= 1
        ) {
          metadataThreshold.value = data.metadataThreshold
        }
      }
      isLoaded = true
    } catch (err) {
      console.error('[uiSettings] failed to load', err)
    }
  }

  async function save(): Promise<void> {
    if (!isLoaded) return
    try {
      await set(UI_SETTINGS_KEY, {
        showSource: showSource.value,
        metadataThreshold: metadataThreshold.value,
      })
    } catch (err) {
      console.error('[uiSettings] failed to save', err)
    }
  }

  watch([showSource, metadataThreshold], () => {
    void save()
  })

  function toggleShowSource(): void {
    showSource.value = !showSource.value
  }

  function setMetadataThreshold(value: number): void {
    metadataThreshold.value = Math.min(Math.max(value, 0), 1)
  }

  return {
    showSource,
    metadataThreshold,

    load,
    toggleShowSource,
    setMetadataThreshold,
  }
})
