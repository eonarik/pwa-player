// src/services/persistence/DislikesPersistenceService.ts

import { get, set, del } from 'idb-keyval'
import type { DislikeEntry } from '@/types/dislike'

const DISLIKES_KEY = 'player:dislikes'
const SAVE_DEBOUNCE_MS = 500

interface PersistedDislikes {
  entries: DislikeEntry[]
  savedAt: number
}

export class DislikesPersistenceService {
  private static instance: DislikesPersistenceService | null = null

  private saveTimer: ReturnType<typeof setTimeout> | null = null
  private pending: DislikeEntry[] | null = null

  static getInstance(): DislikesPersistenceService {
    if (!DislikesPersistenceService.instance) {
      DislikesPersistenceService.instance = new DislikesPersistenceService()
    }
    return DislikesPersistenceService.instance
  }

  save(entries: DislikeEntry[]): void {
    this.pending = entries
    if (this.saveTimer !== null) return

    this.saveTimer = setTimeout(() => {
      this.saveTimer = null
      const toSave = this.pending
      this.pending = null
      if (!toSave) return
      void this.persistNow(toSave)
    }, SAVE_DEBOUNCE_MS)
  }

  async saveNow(entries: DislikeEntry[]): Promise<void> {
    if (this.saveTimer !== null) {
      clearTimeout(this.saveTimer)
      this.saveTimer = null
    }
    this.pending = null
    await this.persistNow(entries)
  }

  private async persistNow(entries: DislikeEntry[]): Promise<void> {
    try {
      const payload: PersistedDislikes = {
        entries,
        savedAt: Date.now(),
      }
      await set(DISLIKES_KEY, payload)
    } catch (err) {
      console.error('[DislikesPersistenceService] failed to save', err)
    }
  }

  async flush(): Promise<void> {
    if (this.saveTimer !== null) {
      clearTimeout(this.saveTimer)
      this.saveTimer = null
    }
    const toSave = this.pending
    this.pending = null
    if (toSave) {
      await this.persistNow(toSave)
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
    if (this.saveTimer !== null) {
      clearTimeout(this.saveTimer)
      this.saveTimer = null
    }
    this.pending = null
    await del(DISLIKES_KEY)
  }
}

export const dislikesPersistenceService = DislikesPersistenceService.getInstance()
