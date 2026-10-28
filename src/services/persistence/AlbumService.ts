// src/services/persistence/AlbumService.ts

import { get, set, del } from 'idb-keyval'
import { toRaw } from 'vue'
import type { Album } from '@/types/library'

const STORAGE_KEY = 'player:albums'

export class AlbumService {
  private static instance: AlbumService | null = null

  static getInstance(): AlbumService {
    if (!AlbumService.instance) {
      AlbumService.instance = new AlbumService()
    }
    return AlbumService.instance
  }

  async loadAll(): Promise<Record<string, Album>> {
    try {
      const data = await get<Record<string, Album>>(STORAGE_KEY)
      return data ?? {}
    } catch (err) {
      console.error('[albums] failed to load', err)
      return {}
    }
  }

  async saveAll(albums: Record<string, Album>): Promise<void> {
    try {
      const rawAlbums = toRaw(albums)
      // Снимаем Proxy через JSON, чтобы IndexedDB не падал с DataCloneError
      const plain = JSON.parse(JSON.stringify(rawAlbums))
      await set(STORAGE_KEY, plain)
    } catch (err) {
      console.error('[albums] failed to save', err)
    }
  }

  async clear(): Promise<void> {
    try {
      await del(STORAGE_KEY)
    } catch {
      // ignore
    }
  }
}

export const albumService = AlbumService.getInstance()
