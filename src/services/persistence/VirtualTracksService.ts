// src/services/persistence/VirtualTracksService.ts

import { get, set, del } from 'idb-keyval'
import { toRaw } from 'vue'
import type { LibraryTrack } from '@/types/library'

const STORAGE_KEY = 'player:virtualTracks'

export interface PersistedVirtualTrack extends LibraryTrack {
  isVirtual: true
}

export class VirtualTracksService {
  private static instance: VirtualTracksService | null = null

  static getInstance(): VirtualTracksService {
    if (!VirtualTracksService.instance) {
      VirtualTracksService.instance = new VirtualTracksService()
    }
    return VirtualTracksService.instance
  }

  async loadAll(): Promise<Record<string, LibraryTrack>> {
    try {
      const data = await get<Record<string, LibraryTrack>>(STORAGE_KEY)
      return data ?? {}
    } catch (err) {
      console.error('[virtual-tracks] failed to load', err)
      return {}
    }
  }

  async saveAll(tracks: Record<string, LibraryTrack>): Promise<void> {
    try {
      // Снимаем Proxy и глубоко клонируем, чтобы IndexedDB мог сохранить
      const rawTracks = toRaw(tracks)
      const plain = JSON.parse(JSON.stringify(rawTracks))
      await set(STORAGE_KEY, plain)
    } catch (err) {
      console.error('[virtual-tracks] failed to save', err)
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

export const virtualTracksService = VirtualTracksService.getInstance()
