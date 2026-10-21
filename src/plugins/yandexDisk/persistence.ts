// src/plugins/yandexDisk/persistence.ts

import { get, set, del } from 'idb-keyval'
import type { PersistedYandexLibrary } from './types'

/** Кэш живёт 24 часа */
export const YANDEX_CACHE_TTL_MS = 24 * 60 * 60 * 1000

export class YandexPersistenceService {
  private static instance: YandexPersistenceService | null = null

  static getInstance(): YandexPersistenceService {
    if (!YandexPersistenceService.instance) {
      YandexPersistenceService.instance = new YandexPersistenceService()
    }
    return YandexPersistenceService.instance
  }

  private getKey(pluginId: string): string {
    return `player:library:${pluginId}`
  }

  async save(pluginId: string, library: PersistedYandexLibrary): Promise<void> {
    try {
      await set(this.getKey(pluginId), {
        ...library,
        savedAt: Date.now(),
      })
    } catch (err) {
      console.error(`[${pluginId}] failed to save library`, err)
      throw err
    }
  }

  async load(pluginId: string): Promise<PersistedYandexLibrary | null> {
    try {
      const data = await get<PersistedYandexLibrary>(this.getKey(pluginId))
      return data ?? null
    } catch (err) {
      console.error(`[${pluginId}] failed to load library`, err)
      return null
    }
  }

  isFresh(library: PersistedYandexLibrary): boolean {
    return Date.now() - library.savedAt < YANDEX_CACHE_TTL_MS
  }

  async clear(pluginId: string): Promise<void> {
    await del(this.getKey(pluginId))
  }
}

export const yandexPersistenceService = YandexPersistenceService.getInstance()
