// src/services/persistence/DislikesPersistenceService.ts

import { get, set, del } from 'idb-keyval'
import type { DislikeEntry } from '@/types/dislike'

const DISLIKES_KEY = 'player:dislikes'

interface PersistedDislikes {
  entries: DislikeEntry[]
  savedAt: number
}

export class DislikesPersistenceService {
  private static instance: DislikesPersistenceService | null = null

  static getInstance(): DislikesPersistenceService {
    if (!DislikesPersistenceService.instance) {
      DislikesPersistenceService.instance = new DislikesPersistenceService()
    }
    return DislikesPersistenceService.instance
  }

  async save(entries: DislikeEntry[]): Promise<void> {
    try {
      const payload: PersistedDislikes = {
        entries,
        savedAt: Date.now(),
      }
      await set(DISLIKES_KEY, payload)
    } catch (err) {
      console.error('[DislikesPersistenceService] failed to save', err)
      throw err
    }
  }

  async load(): Promise<DislikeEntry[] | null> {
    try {
      const data = await get<PersistedDislikes>(DISLIKES_KEY)
      return data?.entries ?? null
    } catch (err) {
      console.error('[DislikesPersistenceService] failed to load', err)
      return null
    }
  }

  async clear(): Promise<void> {
    await del(DISLIKES_KEY)
  }
}

export const dislikesPersistenceService = DislikesPersistenceService.getInstance()
