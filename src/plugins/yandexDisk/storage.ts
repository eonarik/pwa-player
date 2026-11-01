// src/plugins/yandexDisk/storage.ts

import { get, set, del } from 'idb-keyval';
import type { PluginSnapshot } from '../types';

export interface PluginStorageKeys {
  pathMap: string;
  foldersCache: string;
}

/**
 * In-memory кэш `pathMap`/`foldersCache` с персистом в IndexedDB.
 *
 * - `load()` — один раз при старте плагина: читает IDB, мигрирует из localStorage
 *   (старые ключи `${pluginId}:pathMap`/`${pluginId}:foldersCache`), удаляет из localStorage.
 * - `getPathMap()`/`getFoldersCache()` — синхронные, из памяти (быстро, без await).
 * - `setPathMap()`/`setFoldersCache()` — синхронные, пишут в память + debounce в IDB.
 * - `flush()` — форсирует запись в IDB (для beforeunload / disconnect).
 * - `clear()` — очищает память, IDB и legacy localStorage.
 *
 * In-memory кэш нужен, потому что `scanAll`/`scanFolder` вызывают storage
 * десятки раз за скан; `await` на каждый вызов замедлил бы скан.
 */
export function createPluginStorage(pluginId: string) {
  const keys: PluginStorageKeys = {
    pathMap: `yandex:${pluginId}:pathMap`,
    foldersCache: `yandex:${pluginId}:foldersCache`,
  };

  const legacyKeys: PluginStorageKeys = {
    pathMap: `${pluginId}:pathMap`,
    foldersCache: `${pluginId}:foldersCache`,
  };

  let pathMap: Record<string, string> = {};
  let foldersCache: PluginSnapshot['folders'] | null = null;

  let loaded = false;
  let loadPromise: Promise<void> | null = null;
  let writeTimer: ReturnType<typeof setTimeout> | null = null;
  const WRITE_DEBOUNCE_MS = 500;

  function readLS<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  function removeLS(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }

  async function load(): Promise<void> {
    if (loaded) return;
    if (loadPromise) return loadPromise;

    loadPromise = (async () => {
      try {
        const idbPathMap = await get<Record<string, string>>(keys.pathMap);
        const idbFoldersCache = await get<PluginSnapshot['folders']>(keys.foldersCache);

        // --- pathMap ---
        if (idbPathMap && typeof idbPathMap === 'object') {
          pathMap = idbPathMap;
        } else {
          // Миграция из localStorage
          const lsPathMap = readLS<Record<string, string>>(legacyKeys.pathMap);
          if (lsPathMap && typeof lsPathMap === 'object') {
            pathMap = lsPathMap;
            await set(keys.pathMap, lsPathMap);
            removeLS(legacyKeys.pathMap);
            console.info(`[yandex:${pluginId}] migrated pathMap from localStorage to IDB`);
          }
        }

        // --- foldersCache ---
        if (Array.isArray(idbFoldersCache)) {
          foldersCache = idbFoldersCache;
        } else {
          const lsFoldersCache = readLS<PluginSnapshot['folders']>(legacyKeys.foldersCache);
          if (Array.isArray(lsFoldersCache)) {
            foldersCache = lsFoldersCache;
            await set(keys.foldersCache, lsFoldersCache);
            removeLS(legacyKeys.foldersCache);
            console.info(`[yandex:${pluginId}] migrated foldersCache from localStorage to IDB`);
          }
        }

        loaded = true;
      } catch (err) {
        console.error(`[yandex:${pluginId}] storage.load failed`, err);
        loaded = true;
      } finally {
        loadPromise = null;
      }
    })();

    return loadPromise;
  }

  function schedulePersist(): void {
    if (writeTimer !== null) return;
    writeTimer = setTimeout(() => {
      writeTimer = null;
      void persist();
    }, WRITE_DEBOUNCE_MS);
  }

  async function persist(): Promise<void> {
    try {
      await set(keys.pathMap, pathMap);
      if (foldersCache !== null) {
        await set(keys.foldersCache, foldersCache);
      }
    } catch (err) {
      console.warn(`[yandex:${pluginId}] storage.persist failed`, err);
    }
  }

  return {
    /** Один раз при старте плагина. */
    load,

    getPathMap(): Record<string, string> {
      return pathMap;
    },

    setPathMap(map: Record<string, string>): void {
      pathMap = map;
      schedulePersist();
    },

    getFoldersCache(): PluginSnapshot['folders'] | null {
      return foldersCache;
    },

    setFoldersCache(folders: PluginSnapshot['folders']): void {
      foldersCache = folders;
      schedulePersist();
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

    /** Форсирует запись (для beforeunload / disconnect). */
    async flush(): Promise<void> {
      if (writeTimer !== null) {
        clearTimeout(writeTimer);
        writeTimer = null;
      }
      await persist();
    },

    /** Очищает память, IDB и legacy localStorage. */
    async clear(): Promise<void> {
      pathMap = {};
      foldersCache = null;
      loaded = true;
      if (writeTimer !== null) {
        clearTimeout(writeTimer);
        writeTimer = null;
      }
      try {
        await Promise.all([del(keys.pathMap), del(keys.foldersCache)]);
      } catch (err) {
        console.warn(`[yandex:${pluginId}] storage.clear (IDB) failed`, err);
      }
      removeLS(legacyKeys.pathMap);
      removeLS(legacyKeys.foldersCache);
    },
  };
}

export type PluginStorage = ReturnType<typeof createPluginStorage>;
