// src/main.ts

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
import { metadataPersistenceService } from '@/services/persistence/MetadataPersistenceService'

import './assets/main.css'
import { usePlaylistsStore } from './stores/playlists'
import { useLibraryStore } from './stores/library.ts'
import { usePlayerStore } from './stores/player.ts'
import { downloadOrchestrator } from './services/download/DownloadOrchestrator.ts'
import { syncService } from './services/download/SyncService.ts'
import { downloadSpaceService } from './services/download/DownloadSpaceService.ts'
import { librarySaveService } from './services/library/LibrarySaveService.ts'
import { useHistoryStore } from './stores/history.ts'
import { useDislikesStore } from './stores/dislikes.ts'
import { useUiSettingsStore } from './stores/uiSettings.ts'

async function bootstrap() {
  try {
    const wasCleared = await schemaService.ensureCompatible()
    if (wasCleared) {
      console.info('[app] persisted data cleared due to schema change')
    }
  } catch (err) {
    console.error('[app] schema check failed', err)
  }

  const app = createApp(App)
  app.use(createPinia())
  app.use(router)

  const playlists = usePlaylistsStore()
  await playlists.restore()

  app.mount('#app')

  const flushAll = () => {
    void librarySaveService.flushAll()
    void metadataPersistenceService.flush()
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
