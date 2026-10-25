// src/main

import { Buffer } from 'buffer'
import process from 'process'

if (typeof window.global === 'undefined') {
  window.global = globalThis
}
if (typeof window.Buffer === 'undefined') {
  window.Buffer = Buffer
}
if (typeof window.process === 'undefined') {
  window.process = process
}

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import '@/plugins/registry'

import App from './App.vue'
import router from './router'
import { schemaService } from '@/services/persistence/SchemaService'

import './assets/main.css'
import { usePlaylistsStore } from './stores/playlists'
import { useLibraryStore } from './stores/library'
import { usePlayerStore } from './stores/player'
import { downloadOrchestrator } from './services/download/DownloadOrchestrator'
import { syncService } from './services/download/SyncService'
import { downloadSpaceService } from './services/download/DownloadSpaceService'
import { librarySaveService } from './services/library/LibrarySaveService'
import { useHistoryStore } from './stores/history'
import { useDislikesStore } from './stores/dislikes'
import { useUiSettingsStore } from './stores/uiSettings'
import { initTooltip, tooltip } from './directives/tooltip'
import { getExtensionRoutes, loadExtensions } from './plugins/extensions.ts'
import { themeService } from './services/ui/ThemeService.ts'
import { metadataService } from './services/metadata/MetadataService.ts'

async function bootstrap() {
  themeService.load()

  try {
    const wasCleared = await schemaService.ensureCompatible()
    if (wasCleared) {
      console.info('[app] persisted data cleared due to schema change')
    }
  } catch (err) {
    console.error('[app] schema check failed', err)
  }

  // Запрашиваем постоянное хранилище
  if (navigator.storage && navigator.storage.persist) {
    try {
      const isPersisted = await navigator.storage.persist()
      console.info(`[storage] Persistent storage granted: ${isPersisted}`)
    } catch (err) {
      console.warn('[storage] Failed to request persistent storage', err)
    }
  }

  // 1. Загружаем расширения ДО создания приложения
  await loadExtensions()

  const app = createApp(App)
  app.use(createPinia())

  app.directive('tooltip', tooltip)
  initTooltip()

  // 2. Добавляем роуты от плагинов
  const extRoutes = getExtensionRoutes()
  for (const route of extRoutes) {
    router.addRoute(route)
  }

  app.use(router)

  const playlists = usePlaylistsStore()
  await playlists.restore()

  app.mount('#app')

  const flushAll = () => {
    void librarySaveService.flushAll()
    void metadataService.flush()
    void usePlaylistsStore().flush()
    void useHistoryStore().flush()
    void useDislikesStore().flush()
    void useUiSettingsStore().flush()
  }

  window.addEventListener('beforeunload', flushAll)
  window.addEventListener('pagehide', flushAll)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushAll()
  })

  if (import.meta.env.DEV) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).__library = useLibraryStore
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).__player = usePlayerStore
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).__downloads = downloadOrchestrator
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).__sync = syncService
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).__space = downloadSpaceService
  }
}

bootstrap()
