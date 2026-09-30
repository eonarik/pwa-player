// src/main.ts

import { Buffer } from 'buffer'
import process from 'process'

// Полифилы для music-metadata-browser
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
import { coverPersistenceService } from '@/services/persistence/CoverPersistenceService'

import './assets/main.css'
import { usePlaylistsStore } from './stores/playlists'
import { useLibraryStore } from './stores/library.ts'
import { usePlayerStore } from './stores/player.ts'
import { downloadOrchestrator } from './services/download/DownloadOrchestrator.ts'
import { syncService } from './services/download/SyncService.ts'
import { downloadSpaceService } from './services/download/DownloadSpaceService.ts'
import { librarySaveService } from './services/library/LibrarySaveService.ts'

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

  // Восстановить плейлисты до маунта
  const playlists = usePlaylistsStore()
  await playlists.restore()

  app.mount('#app')

  window.addEventListener('beforeunload', () => {
    void librarySaveService.flushAll()
    void coverPersistenceService.flush()
  })
  window.addEventListener('pagehide', () => {
    void librarySaveService.flushAll()
    void coverPersistenceService.flush()
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      void librarySaveService.flushAll()
      void coverPersistenceService.flush()
    }
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
