// src/services/persistence/PlaylistPersistenceService.ts

import { get, set, del } from 'idb-keyval'
import type { Playlist } from '@/types/playlist'
import type { PersistedPlaylists } from './playlistTypes'

const PLAYLISTS_KEY = 'player:playlists'
const SAVE_DEBOUNCE_MS = 500

export class PlaylistPersistenceService {
  private static instance: PlaylistPersistenceService | null = null

  private saveTimer: ReturnType<typeof setTimeout> | null = null
  private pending: Playlist[] | null = null

  static getInstance(): PlaylistPersistenceService {
    if (!PlaylistPersistenceService.instance) {
      PlaylistPersistenceService.instance = new PlaylistPersistenceService()
    }
    return PlaylistPersistenceService.instance
  }

  /**
   * Сохраняет плейлисты с дебаунсом 500 мс.
   * Частые изменения (например, добавление трека в цикле) сольются в одну запись.
   */
  save(playlists: Playlist[]): void {
    this.pending = playlists

    if (this.saveTimer !== null) return

    this.saveTimer = setTimeout(() => {
      this.saveTimer = null
      const toSave = this.pending
      this.pending = null
      if (!toSave) return
      void this.persistNow(toSave)
    }, SAVE_DEBOUNCE_MS)
  }

  /** Немедленное сохранение — при beforeunload / visibilitychange */
  async saveNow(playlists: Playlist[]): Promise<void> {
    if (this.saveTimer !== null) {
      clearTimeout(this.saveTimer)
      this.saveTimer = null
    }
    this.pending = null
    await this.persistNow(playlists)
  }

  private async persistNow(playlists: Playlist[]): Promise<void> {
    try {
      const payload: PersistedPlaylists = {
        playlists,
        savedAt: Date.now(),
      }
      await set(PLAYLISTS_KEY, payload)
    } catch (err) {
      console.error('[PlaylistPersistenceService] failed to save', err)
    }
  }

  /** Дожидается окончания pending-сохранения (для тестов и beforeunload) */
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

  async load(): Promise<Playlist[] | null> {
    try {
      const data = await get<PersistedPlaylists>(PLAYLISTS_KEY)
      return data?.playlists ?? null
    } catch (err) {
      console.error('[PlaylistPersistenceService] failed to load', err)
      return null
    }
  }

  async clear(): Promise<void> {
    if (this.saveTimer !== null) {
      clearTimeout(this.saveTimer)
      this.saveTimer = null
    }
    this.pending = null
    await del(PLAYLISTS_KEY)
  }
}

export const playlistPersistenceService = PlaylistPersistenceService.getInstance()
