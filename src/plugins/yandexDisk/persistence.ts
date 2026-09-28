// src/plugins/yandex/persistence.ts

import { get, set, del } from 'idb-keyval'
import type { PersistedYandexLibrary } from './types'

const YANDEX_LIBRARY_KEY = 'player:yandexLibrary'

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

  async save(library: PersistedYandexLibrary): Promise<void> {
    try {
      await set(YANDEX_LIBRARY_KEY, {
        ...library,
        savedAt: Date.now(),
      })
    } catch (err) {
      console.error('[yandex-plugin] failed to save library', err)
      throw err
    }
  }

  async load(): Promise<PersistedYandexLibrary | null> {
    try {
      const data = await get<PersistedYandexLibrary>(YANDEX_LIBRARY_KEY)
      return data ?? null
    } catch (err) {
      console.error('[yandex-plugin] failed to load library', err)
      return null
    }
  }

  isFresh(library: PersistedYandexLibrary): boolean {
    return Date.now() - library.savedAt < YANDEX_CACHE_TTL_MS
  }

  async clear(): Promise<void> {
    await del(YANDEX_LIBRARY_KEY)
  }
}

export const yandexPersistenceService = YandexPersistenceService.getInstance()
