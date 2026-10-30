// src/composables/usePluginsList.ts

import { ref, computed, onMounted, onUnmounted } from 'vue';
import { getPlugins, loadPlugin, setPluginDisconnected, isPluginActivated } from '@/plugins/registry';
import { downloadSpaceService } from '@/services/download/DownloadSpaceService';
import type { PluginManifest, LibrarySource } from '@/plugins/types';

export type SessionStatus = 'checking' | 'ok' | 'expired' | 'unavailable';

export interface PluginMeta {
  manifest: PluginManifest;
  plugin: LibrarySource;
  available: boolean;
  isDisconnected: boolean;
}

export interface DisplayPlugin extends PluginMeta {
  hasCustomData: boolean;
  hasLocalFiles: boolean;
  isStateless: boolean;
  spaceAvailable: boolean;
}

export function usePluginsList() {
  const pluginMetas = ref<PluginMeta[]>([]);
  const customDataMap = ref<Record<string, boolean>>({});
  const sessionStatuses = ref<Record<string, SessionStatus>>({});
  const isOffline = ref(!navigator.onLine);

  let onlineInterval: ReturnType<typeof setInterval> | null = null;
  let isUnmounted = false;

  const spaceAvailable = computed(
    () => downloadSpaceService.hasSpace.value && !downloadSpaceService.needsPermission.value,
  );

  const plugins = computed<DisplayPlugin[]>(() => {
    return pluginMetas.value.map((meta) => {
      const isStateless = Boolean(meta.manifest.isStateless);
      const isDisconnected = isStateless ? false : meta.isDisconnected;

      const hasCustomData = isStateless
        ? Boolean(customDataMap.value[meta.manifest.id])
        : Boolean(meta.manifest.hasCustomData) && Boolean(customDataMap.value[meta.manifest.id]);

      const hasLocalFiles = Boolean(customDataMap.value[meta.manifest.id]);

      return {
        ...meta,
        isDisconnected,
        isStateless,
        hasCustomData,
        hasLocalFiles,
        spaceAvailable: spaceAvailable.value,
      };
    });
  });

  function sessionStatus(pluginId: string): SessionStatus | undefined {
    return sessionStatuses.value[pluginId];
  }

  function isChecking(pluginId: string): boolean {
    return sessionStatuses.value[pluginId] === 'checking';
  }

  async function checkSessionFor(plugin: LibrarySource, pluginId: string): Promise<void> {
    if (!plugin.checkSession) {
      sessionStatuses.value = { ...sessionStatuses.value, [pluginId]: 'ok' };
      return;
    }

    sessionStatuses.value = { ...sessionStatuses.value, [pluginId]: 'checking' };

    let status: SessionStatus = 'ok';
    try {
      status = await plugin.checkSession();
    } catch (err) {
      // Если это AbortError (компонент размонтирован или запрос отменен) — игнорируем
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      status = 'unavailable';
    }

    // Если компонент уже размонтирован, не обновляем реактивное состояние
    if (isUnmounted) return;

    sessionStatuses.value = { ...sessionStatuses.value, [pluginId]: status };

    if (status === 'expired') {
      plugin.markDisconnected?.();
      setPluginDisconnected(pluginId, true);

      const idx = pluginMetas.value.findIndex((m) => m.manifest.id === pluginId);
      if (idx !== -1) {
        const next = [...pluginMetas.value];
        next[idx] = { ...next[idx]!, isDisconnected: true };
        pluginMetas.value = next;
      }
    }
  }

  async function checkLocalFiles(pluginId: string): Promise<boolean> {
    if (!downloadSpaceService.hasSpace.value) return false;
    try {
      const dir = await downloadSpaceService.getPluginDirIfExists(pluginId);
      if (!dir) return false;
      for await (const _entry of dir.values()) {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  async function loadPlugins(): Promise<void> {
    const metas: PluginMeta[] = [];
    for (const manifest of getPlugins()) {
      if (manifest.requiresActivation && !isPluginActivated(manifest.id)) continue;
      try {
        const plugin = await loadPlugin(manifest.id);
        metas.push({
          manifest,
          plugin,
          available: plugin.isAvailable(),
          isDisconnected: plugin.isDisconnected?.() ?? false,
        });
      } catch (err) {
        console.warn(`[home] failed to load plugin ${manifest.id}`, err);
      }
    }

    if (isUnmounted) return;
    pluginMetas.value = metas;

    for (const meta of metas) {
      if (meta.manifest.hasCustomData) {
        try {
          const hasData = await meta.manifest.hasCustomData();
          if (isUnmounted) return;
          customDataMap.value[meta.manifest.id] = hasData;
        } catch {
          if (isUnmounted) return;
          customDataMap.value[meta.manifest.id] = false;
        }
      }
    }

    for (const meta of metas) {
      if (!meta.plugin.canDownload) continue;
      if (!spaceAvailable.value) continue;
      try {
        const hasLocal = await checkLocalFiles(meta.manifest.id);
        if (isUnmounted) return;
        if (hasLocal) customDataMap.value[meta.manifest.id] = true;
      } catch (err) {
        console.warn(`[home] failed to check local files for ${meta.manifest.id}`, err);
      }
    }

    for (const meta of metas) {
      if (meta.manifest.isStateless) continue;
      void checkSessionFor(meta.plugin, meta.manifest.id);
    }
  }

  function syncOnlineStatus(): void {
    isOffline.value = !navigator.onLine;
  }

  function onOnline(): void {
    syncOnlineStatus();
  }

  function onOffline(): void {
    syncOnlineStatus();
  }

  onMounted(() => {
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    onlineInterval = setInterval(syncOnlineStatus, 5000);
  });

  onUnmounted(() => {
    isUnmounted = true;
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
    if (onlineInterval !== null) {
      clearInterval(onlineInterval);
      onlineInterval = null;
    }
  });

  return {
    plugins,
    spaceAvailable,
    isOffline,
    sessionStatus,
    isChecking,
    loadPlugins,
  };
}
