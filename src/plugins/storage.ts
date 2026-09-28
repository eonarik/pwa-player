// src/plugins/storage.ts

import { createStore, get, set, del, clear } from 'idb-keyval'
import type { PluginStorage } from './types'

/**
 * Изолированный IDB-store для плагина.
 *
 * Все плагины живут в одной БД ('cuei-plugins'), но в разных store'ах
 * (по одному на pluginId). Плагины не пересекаются по ключам.
 */
export function createPluginStorage(pluginId: string): PluginStorage {
  const store = createStore('cuei-plugins', pluginId)

  return {
    async get<T>(key: string): Promise<T | undefined> {
      try {
        return await get<T>(key, store)
      } catch (err) {
        console.error(`[plugin:${pluginId}] storage.get failed`, err)
        return undefined
      }
    },

    async set<T>(key: string, value: T): Promise<void> {
      try {
        await set(key, value, store)
      } catch (err) {
        console.error(`[plugin:${pluginId}] storage.set failed`, err)
      }
    },

    async del(key: string): Promise<void> {
      try {
        await del(key, store)
      } catch (err) {
        console.error(`[plugin:${pluginId}] storage.del failed`, err)
      }
    },

    async clear(): Promise<void> {
      try {
        await clear(store)
      } catch (err) {
        console.error(`[plugin:${pluginId}] storage.clear failed`, err)
      }
    },
  }
}
