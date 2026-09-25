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

import App from './App.vue'
import router from './router'
import { schemaService } from '@/services/persistence/SchemaService'

import './assets/main.css'
import { usePlaylistsStore } from './stores/playlists.ts'

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
}

bootstrap()
