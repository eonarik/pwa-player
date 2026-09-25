// src/services/persistence/YandexLibraryPersistenceService.ts

import { get, set, del } from 'idb-keyval'
import type { PersistedYandexLibrary } from './yandexTypes'

const YANDEX_LIBRARY_KEY = 'player:yandexLibrary'

/** Кэш живёт 24 часа */
export const YANDEX_CACHE_TTL_MS = 24 * 60 * 60 * 1000

export class YandexLibraryPersistenceService {
  private static instance: YandexLibraryPersistenceService | null = null

  static getInstance(): YandexLibraryPersistenceService {
    if (!YandexLibraryPersistenceService.instance) {
      YandexLibraryPersistenceService.instance = new YandexLibraryPersistenceService()
    }
    return YandexLibraryPersistenceService.instance
  }

  async save(library: PersistedYandexLibrary): Promise<void> {
    try {
      await set(YANDEX_LIBRARY_KEY, {
        ...library,
        savedAt: Date.now(),
      })
    } catch (err) {
      console.error('[YandexLibraryPersistenceService] failed to save', err)
      throw err
    }
  }

  async load(): Promise<PersistedYandexLibrary | null> {
    try {
      const data = await get<PersistedYandexLibrary>(YANDEX_LIBRARY_KEY)
      return data ?? null
    } catch (err) {
      console.error('[YandexLibraryPersistenceService] failed to load', err)
      return null
    }
  }

  /** Свежий ли кэш (не старше TTL) */
  isFresh(library: PersistedYandexLibrary): boolean {
    return Date.now() - library.savedAt < YANDEX_CACHE_TTL_MS
  }

  async clear(): Promise<void> {
    await del(YANDEX_LIBRARY_KEY)
  }
}

export const yandexLibraryPersistenceService = YandexLibraryPersistenceService.getInstance()
