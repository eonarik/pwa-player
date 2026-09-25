// src/services/persistence/HistoryPersistenceService.ts

import { get, set, del } from 'idb-keyval'
import type { PlayHistoryEntry } from '@/types/history'
import type { PersistedHistory } from './historyTypes'

const HISTORY_KEY = 'player:history'

export class HistoryPersistenceService {
  private static instance: HistoryPersistenceService | null = null

  static getInstance(): HistoryPersistenceService {
    if (!HistoryPersistenceService.instance) {
      HistoryPersistenceService.instance = new HistoryPersistenceService()
    }
    return HistoryPersistenceService.instance
  }

  async save(entries: PlayHistoryEntry[]): Promise<void> {
    try {
      const payload: PersistedHistory = {
        entries,
        savedAt: Date.now(),
      }
      await set(HISTORY_KEY, payload)
    } catch (err) {
      console.error('[HistoryPersistenceService] failed to save', err)
      throw err
    }
  }

  async load(): Promise<PlayHistoryEntry[] | null> {
    try {
      const data = await get<PersistedHistory>(HISTORY_KEY)
      return data?.entries ?? null
    } catch (err) {
      console.error('[HistoryPersistenceService] failed to load', err)
      return null
    }
  }

  async clear(): Promise<void> {
    await del(HISTORY_KEY)
  }
}

export const historyPersistenceService = HistoryPersistenceService.getInstance()
