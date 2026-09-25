// src/services/persistence/LibraryPersistenceService.ts

import { get, set, del } from 'idb-keyval'
import type { PersistedLibrary } from './libraryTypes'

const LIBRARY_KEY = 'player:library'

export class LibraryPersistenceService {
  private static instance: LibraryPersistenceService | null = null

  static getInstance(): LibraryPersistenceService {
    if (!LibraryPersistenceService.instance) {
      LibraryPersistenceService.instance = new LibraryPersistenceService()
    }
    return LibraryPersistenceService.instance
  }

  async save(library: PersistedLibrary): Promise<void> {
    try {
      await set(LIBRARY_KEY, {
        ...library,
        savedAt: Date.now(),
      })
    } catch (err) {
      console.error('[LibraryPersistenceService] failed to save', err)
      throw err
    }
  }

  async load(): Promise<PersistedLibrary | null> {
    try {
      const data = await get<PersistedLibrary>(LIBRARY_KEY)
      return data ?? null
    } catch (err) {
      console.error('[LibraryPersistenceService] failed to load', err)
      return null
    }
  }

  async clear(): Promise<void> {
    await del(LIBRARY_KEY)
  }
}

export const libraryPersistenceService = LibraryPersistenceService.getInstance()
