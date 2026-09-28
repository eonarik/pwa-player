// src/plugins/local/persistence.ts

import { get, set, del } from 'idb-keyval'
import type { PersistedLocalLibrary } from './types'

const LIBRARY_KEY = 'player:library'

export class LocalPersistenceService {
  private static instance: LocalPersistenceService | null = null

  static getInstance(): LocalPersistenceService {
    if (!LocalPersistenceService.instance) {
      LocalPersistenceService.instance = new LocalPersistenceService()
    }
    return LocalPersistenceService.instance
  }

  async save(library: PersistedLocalLibrary): Promise<void> {
    try {
      await set(LIBRARY_KEY, {
        ...library,
        savedAt: Date.now(),
      })
    } catch (err) {
      console.error('[local-plugin] failed to save library', err)
      throw err
    }
  }

  async load(): Promise<PersistedLocalLibrary | null> {
    try {
      const data = await get<PersistedLocalLibrary>(LIBRARY_KEY)
      return data ?? null
    } catch (err) {
      console.error('[local-plugin] failed to load library', err)
      return null
    }
  }

  async clear(): Promise<void> {
    await del(LIBRARY_KEY)
  }
}

export const localPersistenceService = LocalPersistenceService.getInstance()
