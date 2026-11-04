// src/main.ts

import { Buffer } from 'buffer';
import process from 'process';

if (typeof window.global === 'undefined') window.global = globalThis;
if (typeof window.Buffer === 'undefined') window.Buffer = Buffer;
if (typeof window.process === 'undefined') window.process = process;

import { createApp } from 'vue';
import { createPinia } from 'pinia';

import '@/plugins/registry';

import App from './App.vue';
import router from './router';
import { schemaService } from '@/services/persistence/SchemaService';
import { initTelemetry } from '@/services/telemetry';

import './assets/main.css';
import { usePlaylistsStore } from './stores/playlists';
import { useLibraryStore } from './stores/library';
import { usePlayerStore } from './stores/player';
import { downloadOrchestrator } from './services/download/DownloadOrchestrator';
import { syncService } from './services/download/SyncService';
import { downloadSpaceService } from './services/download/DownloadSpaceService';
import { librarySaveService } from './services/library/LibrarySaveService';
import { useHistoryStore } from './stores/history';
import { useDislikesStore } from './stores/dislikes';
import { useUiSettingsStore } from './stores/uiSettings';
import { initTooltip, tooltip } from './directives/tooltip';
import { getExtensionRoutes, loadExtensions } from './plugins/extensions';
import { themeService } from './services/ui/ThemeService';
import { metadataService } from './services/metadata/MetadataService';
import { setupFileHandlers } from '@/services/files/setupHandlers';
import { albumService } from './services/persistence/AlbumService.ts';
import { flushLibrary } from './stores/library/store/persist.ts';

async function bootstrap() {
  if (import.meta.env.VITE_TELEMETRY === 'true') {
    initTelemetry();
  }

  themeService.load();

  try {
    const wasCleared = await schemaService.ensureCompatible();
    if (wasCleared) {
    }
  } catch (err) {
    console.error('[app] schema check failed', err);
  }

  if (navigator.storage && navigator.storage.persist) {
    try {
      await navigator.storage.persist();
    } catch (err) {
      console.warn('[storage] Failed to request persistent storage', err);
    }
  }

  await loadExtensions();
  setupFileHandlers();

  const app = createApp(App);

  app.config.errorHandler = (err, _instance, info) => {
    console.error('[Vue Global Error]', err, info);
  };

  app.use(createPinia());
  app.directive('tooltip', tooltip);
  initTooltip();

  const extRoutes = getExtensionRoutes();
  for (const route of extRoutes) {
    router.addRoute(route);
  }

  app.use(router);

  const playlists = usePlaylistsStore();
  await playlists.restore();

  app.mount('#app');

  const bootLoader = document.getElementById('app-boot-loader');
  if (bootLoader) {
    bootLoader.remove();
  }

  const flushAll = () => {
    void librarySaveService.flushAll();
    void metadataService.flush();
    void usePlaylistsStore().flush();
    void useHistoryStore().flush();
    void useDislikesStore().flush();
    void useUiSettingsStore().flush();
    void albumService.flush();
    flushLibrary();
  };

  window.addEventListener('beforeunload', flushAll);
  window.addEventListener('pagehide', flushAll);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushAll();
  });

  window.__library = useLibraryStore;
  window.__player = usePlayerStore;
  window.__downloads = downloadOrchestrator;
  window.__sync = syncService;
  window.__space = downloadSpaceService;
  window.__playlists = usePlaylistsStore;
  window.__history = useHistoryStore;
  window.__dislikes = useDislikesStore;

  if (import.meta.env.DEV) {
    let maxNodes = 0;
    setInterval(() => {
      const count = document.querySelectorAll('*').length;
      if (count > maxNodes) {
        maxNodes = count;
      }
    }, 1000);

    window.__countNodes = () => document.querySelectorAll('*').length;
  }
}

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Unhandled Rejection]', event.reason);
});

bootstrap().catch((err) => {
  console.error('[Bootstrap Fatal Error]', err);

  const textEl = document.getElementById('app-boot-loader-text');
  if (textEl) {
    textEl.textContent = 'Ошибка инициализации приложения. Проверьте консоль.';
  }
  const spinner = document.getElementById('app-boot-spinner');
  if (spinner) {
    spinner.style.display = 'none';
  }
});
