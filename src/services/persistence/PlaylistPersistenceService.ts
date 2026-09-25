// src/services/persistence/PlaylistPersistenceService.ts

import { get, set, del } from 'idb-keyval'
import type { Playlist } from '@/types/playlist'
import type { PersistedPlaylists } from './playlistTypes'

const PLAYLISTS_KEY = 'player:playlists'

export class PlaylistPersistenceService {
  private static instance: PlaylistPersistenceService | null = null

  static getInstance(): PlaylistPersistenceService {
    if (!PlaylistPersistenceService.instance) {
      PlaylistPersistenceService.instance = new PlaylistPersistenceService()
    }
    return PlaylistPersistenceService.instance
  }

  async save(playlists: Playlist[]): Promise<void> {
    try {
      const payload: PersistedPlaylists = {
        playlists,
        savedAt: Date.now(),
      }
      await set(PLAYLISTS_KEY, payload)
    } catch (err) {
      console.error('[PlaylistPersistenceService] failed to save', err)
      throw err
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
    await del(PLAYLISTS_KEY)
  }
}

export const playlistPersistenceService = PlaylistPersistenceService.getInstance()
