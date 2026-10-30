// src/plugins/storage.ts

import { get, set, del } from 'idb-keyval';
import type { PluginStorage } from './types';

// Префикс, чтобы не пересекаться с ключами ядра (например, player:state)
const PREFIX = 'plugin:';

/**
 * Хранилище плагина поверх дефолтного keyval-store.
 *
 * Используем ПРЕФИКСЫ в ключах вместо отдельных object stores.
 * Это решает проблему "One of the specified object stores was not found",
 * которая возникала при удалении базы или использовании idb-keyval с createStore.
 */
export function createPluginStorage(pluginId: string): PluginStorage {
  const prefix = `${PREFIX}${pluginId}:`;

  const makeKey = (key: string) => `${prefix}${key}`;

  return {
    async get<T>(key: string): Promise<T | undefined> {
      try {
        return await get<T>(makeKey(key));
      } catch (err) {
        console.error(`[plugin:${pluginId}] storage.get failed`, err);
        return undefined;
      }
    },

    async set<T>(key: string, value: T): Promise<void> {
      try {
        await set(makeKey(key), value);
      } catch (err) {
        console.error(`[plugin:${pluginId}] storage.set failed`, err);
        throw err;
      }
    },

    async del(key: string): Promise<void> {
      try {
        await del(makeKey(key));
      } catch (err) {
        console.error(`[plugin:${pluginId}] storage.del failed`, err);
      }
    },

    async clear(): Promise<void> {
      try {
        // idb-keyval.clear() очищает ВЕСЬ keyval-store.
        // Нам нужно удалить только ключи этого плагина.
        // Так как idb-keyval не поддерживает keys(), мы делаем это через clear:
        // На самом деле, если мы хотим удалить только ключи плагина,
        // нам нужно использовать keys() из idb-keyval (если он есть в v6)
        //
        // В idb-keyval v6 есть keys(store?) для получения всех ключей дефолтного стора.
        const { keys } = await import('idb-keyval');
        const allKeys = await keys();
        const toDelete = allKeys.filter((k) => typeof k === 'string' && k.startsWith(prefix));

        await Promise.all(toDelete.map((k) => del(k)));
      } catch (err) {
        console.error(`[plugin:${pluginId}] storage.clear failed`, err);
      }
    },
  };
}
