// src/services/persistence/PersistenceService.ts

import { get, set, del } from 'idb-keyval'
import { toRaw } from 'vue'
import type { PersistedPlayback, PersistedState, PersistedTrack } from './types'
import type { Track } from '@/types/track'

const STATE_KEY = 'player:state'
const PLAYBACK_KEY = 'player:playback'

const STATE_DEBOUNCE_MS = 1000
const PLAYBACK_DEBOUNCE_MS = 2000

export class PersistenceService {
  private static instance: PersistenceService | null = null

  private stateTimer: ReturnType<typeof setTimeout> | null = null
  private pendingState: PersistedState | null = null

  private playbackTimer: ReturnType<typeof setTimeout> | null = null
  private pendingPlayback: PersistedPlayback | null = null

  static getInstance(): PersistenceService {
    if (!PersistenceService.instance) {
      PersistenceService.instance = new PersistenceService()
    }
    return PersistenceService.instance
  }

  // --- State (queue + настройки) --------------------------------------

  /**
   * Сохраняет состояние с дебаунсом 1 сек.
   * Дешёво по сравнению с playback (queue сохраняется редко).
   */
  scheduleSaveState(state: PersistedState): void {
    this.pendingState = state

    if (this.stateTimer !== null) return

    this.stateTimer = setTimeout(async () => {
      this.stateTimer = null
      const toSave = this.pendingState
      this.pendingState = null
      if (!toSave) return

      try {
        await set(STATE_KEY, toSave)
      } catch (err) {
        console.error('[PersistenceService] failed to save state', err)
      }
    }, STATE_DEBOUNCE_MS)
  }

  /** Немедленное сохранение состояния — вызывать при beforeunload */
  async saveStateNow(state: PersistedState): Promise<void> {
    if (this.stateTimer !== null) {
      clearTimeout(this.stateTimer)
      this.stateTimer = null
    }
    this.pendingState = null
    try {
      await set(STATE_KEY, state)
    } catch (err) {
      console.error('[PersistenceService] failed to save state (now)', err)
    }
  }

  async loadState(): Promise<PersistedState | null> {
    try {
      const state = await get<PersistedState>(STATE_KEY)
      return state ?? null
    } catch (err) {
      console.error('[PersistenceService] failed to load state', err)
      return null
    }
  }

  // --- Playback (currentTime) -----------------------------------------

  /**
   * Сохраняет позицию воспроизведения с дебаунсом 2 сек.
   * Меняется часто (rAF), поэтому отдельный канал.
   */
  scheduleSavePlayback(playback: PersistedPlayback): void {
    this.pendingPlayback = playback

    if (this.playbackTimer !== null) return

    this.playbackTimer = setTimeout(async () => {
      this.playbackTimer = null
      const toSave = this.pendingPlayback
      this.pendingPlayback = null
      if (!toSave) return

      try {
        await set(PLAYBACK_KEY, toSave)
      } catch (err) {
        console.error('[PersistenceService] failed to save playback', err)
      }
    }, PLAYBACK_DEBOUNCE_MS)
  }

  /** Немедленное сохранение позиции — при pause / ended / unload / beforeunload */
  async savePlaybackNow(playback: PersistedPlayback): Promise<void> {
    if (this.playbackTimer !== null) {
      clearTimeout(this.playbackTimer)
      this.playbackTimer = null
    }
    this.pendingPlayback = null
    try {
      await set(PLAYBACK_KEY, playback)
    } catch (err) {
      console.error('[PersistenceService] failed to save playback (now)', err)
    }
  }

  async loadPlayback(): Promise<PersistedPlayback | null> {
    try {
      const playback = await get<PersistedPlayback>(PLAYBACK_KEY)
      return playback ?? null
    } catch (err) {
      console.error('[PersistenceService] failed to load playback', err)
      return null
    }
  }

  // --- Очистка -------------------------------------------------------

  async clear(): Promise<void> {
    await this.clearState()
    await this.clearPlayback()
  }

  async clearState(): Promise<void> {
    await del(STATE_KEY)
  }

  async clearPlayback(): Promise<void> {
    await del(PLAYBACK_KEY)
  }

  // --- Сериализация трека ---------------------------------------------

  /**
   * Сериализует Track для IDB.
   * toRaw нужен, потому что track может быть reactive proxy от Vue —
   * FileSystemHandle внутри proxy не клонируется через structuredClone.
   */
  toPersisted(track: Track): PersistedTrack {
    const raw = toRaw(track)
    return {
      id: raw.id,
      pluginId: raw.pluginId,
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
}

export const persistenceService = PersistenceService.getInstance()
