// src/services/persistence/PersistenceService.ts

import { get, set, del } from 'idb-keyval'
import { toRaw } from 'vue'
import type { PersistedState, PersistedTrack } from './types'
import type { Track } from '@/types/track'

const STATE_KEY = 'player:state'
const SAVE_DEBOUNCE_MS = 1000

export class PersistenceService {
  private static instance: PersistenceService | null = null

  private saveTimer: ReturnType<typeof setTimeout> | null = null
  private pendingState: PersistedState | null = null

  static getInstance(): PersistenceService {
    if (!PersistenceService.instance) {
      PersistenceService.instance = new PersistenceService()
    }
    return PersistenceService.instance
  }

  /**
   * Сохраняет состояние с дебаунсом.
   * currentTime меняется 10 раз в секунду — писать в IDB каждый раз нельзя.
   */
  scheduleSave(state: PersistedState): void {
    this.pendingState = state

    if (this.saveTimer !== null) return

    this.saveTimer = setTimeout(async () => {
      this.saveTimer = null
      const toSave = this.pendingState
      this.pendingState = null
      if (!toSave) return

      try {
        await set(STATE_KEY, toSave)
      } catch (err) {
        console.error('[PersistenceService] failed to save state', err)
      }
    }, SAVE_DEBOUNCE_MS)
  }

  /** Немедленное сохранение — вызывать при beforeunload */
  async saveNow(state: PersistedState): Promise<void> {
    if (this.saveTimer !== null) {
      clearTimeout(this.saveTimer)
      this.saveTimer = null
    }
    this.pendingState = null
    try {
      await set(STATE_KEY, state)
    } catch (err) {
      console.error('[PersistenceService] failed to save state (now)', err)
    }
  }

  async load(): Promise<PersistedState | null> {
    try {
      const state = await get<PersistedState>(STATE_KEY)
      return state ?? null
    } catch (err) {
      console.error('[PersistenceService] failed to load state', err)
      return null
    }
  }

  async clear(): Promise<void> {
    await del(STATE_KEY)
  }

  // --- Сериализация -----------------------------------------------------

  /**
   * Сериализует Track для IDB.
   * toRaw нужен, потому что track может быть reactive proxy от Vue —
   * FileSystemHandle внутри proxy не клонируется через structuredClone.
   */
  toPersisted(track: Track): PersistedTrack {
    const raw = toRaw(track)
    return {
      id: raw.id,
      title: raw.title,
      artist: raw.artist,
      album: raw.album,
      year: raw.year,
      trackNumber: raw.trackNumber,
      genre: raw.genre,
      duration: raw.duration,
      codec: raw.codec,
      filename: raw.filename,
      path: raw.path,
      handle: raw.handle ? toRaw(raw.handle) : undefined,
      directoryHandle: raw.directoryHandle ? toRaw(raw.directoryHandle) : undefined,
    }
  }

  async clearAll(): Promise<void> {
    await this.clear()
  }
}

export const persistenceService = PersistenceService.getInstance()
