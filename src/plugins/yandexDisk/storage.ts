// src/plugins/yandexDisk/storage.ts

import type { PluginSnapshot } from '../types';

export interface PluginStorageKeys {
  pathMap: string;
  foldersCache: string;
}

export function createPluginStorage(pluginId: string) {
  const keys: PluginStorageKeys = {
    pathMap: `${pluginId}:pathMap`,
    foldersCache: `${pluginId}:foldersCache`,
  };

  return {
    getPathMap(): Record<string, string> {
      try {
        const raw = localStorage.getItem(keys.pathMap);
        return raw ? JSON.parse(raw) : {};
      } catch {
        return {};
      }
    },

    setPathMap(map: Record<string, string>): void {
      try {
        localStorage.setItem(keys.pathMap, JSON.stringify(map));
      } catch (err) {
        console.warn(`[${pluginId}] failed to save pathMap`, err);
      }
    },

    getFoldersCache(): PluginSnapshot['folders'] | null {
      try {
        const raw = localStorage.getItem(keys.foldersCache);
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    },

    setFoldersCache(folders: PluginSnapshot['folders']): void {
      try {
        localStorage.setItem(keys.foldersCache, JSON.stringify(folders));
      } catch (err) {
        console.warn(`[${pluginId}] failed to save folders cache`, err);
      }
    },

    clear(): void {
      localStorage.removeItem(keys.pathMap);
      localStorage.removeItem(keys.foldersCache);
    },

    /**
     * Сливает новые папки в кеш: перезаписывает по id, добавляет отсутствующие.
     */
    mergeFoldersCache(
      existing: PluginSnapshot['folders'],
      incoming: PluginSnapshot['folders'],
    ): PluginSnapshot['folders'] {
      const map = new Map<string, PluginSnapshot['folders'][number]>();
      for (const f of existing) map.set(f.id, f);
      for (const f of incoming) map.set(f.id, f);
      return Array.from(map.values());
    },
  };
}

export type PluginStorage = ReturnType<typeof createPluginStorage>;
