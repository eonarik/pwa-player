// src/stores/uiSettings.ts

import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { get, set } from 'idb-keyval'

const UI_SETTINGS_KEY = 'player:uiSettings'

interface PersistedUiSettings {
  showSource: boolean
}

export const useUiSettingsStore = defineStore('uiSettings', () => {
  const showSource = ref(false)

  let isLoaded = false

  async function load(): Promise<void> {
    if (isLoaded) return
    try {
      const data = await get<PersistedUiSettings>(UI_SETTINGS_KEY)
      if (data) {
        showSource.value = data.showSource ?? false
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
      })
    } catch (err) {
      console.error('[uiSettings] failed to save', err)
    }
  }

  watch(showSource, () => {
    void save()
  })

  function toggleShowSource(): void {
    showSource.value = !showSource.value
  }

  return {
    showSource,
    load,
    toggleShowSource,
  }
})
