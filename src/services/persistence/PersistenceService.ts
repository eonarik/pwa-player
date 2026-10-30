// src/services/persistence/PersistenceService.ts

import { get, set, del } from 'idb-keyval';
import type { PersistedPlayback, PersistedState, PersistedTrack } from './types';
import type { Track } from '@/types/track';

const STATE_KEY = 'player:state';
const PLAYBACK_KEY = 'player:playback';

const STATE_DEBOUNCE_MS = 1000;
const PLAYBACK_DEBOUNCE_MS = 2000;

export class PersistenceService {
  private static instance: PersistenceService | null = null;

  private stateTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingState: PersistedState | null = null;

  private playbackTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingPlayback: PersistedPlayback | null = null;

  static getInstance(): PersistenceService {
    if (!PersistenceService.instance) {
      PersistenceService.instance = new PersistenceService();
    }
    return PersistenceService.instance;
  }

  scheduleSaveState(state: PersistedState): void {
    this.pendingState = state;
    if (this.stateTimer !== null) return;

    this.stateTimer = setTimeout(async () => {
      this.stateTimer = null;
      const toSave = this.pendingState;
      this.pendingState = null;
      if (!toSave) return;
      try {
        await set(STATE_KEY, toSave);
      } catch (err) {
        console.error('[PersistenceService] failed to save state', err);
      }
    }, STATE_DEBOUNCE_MS);
  }

  async saveStateNow(state: PersistedState): Promise<void> {
    if (this.stateTimer !== null) {
      clearTimeout(this.stateTimer);
      this.stateTimer = null;
    }
    this.pendingState = null;
    try {
      await set(STATE_KEY, state);
    } catch (err) {
      console.error('[PersistenceService] failed to save state (now)', err);
    }
  }

  async loadState(): Promise<PersistedState | null> {
    try {
      const state = await get<PersistedState>(STATE_KEY);
      return state ?? null;
    } catch (err) {
      console.error('[PersistenceService] failed to load state', err);
      return null;
    }
  }

  scheduleSavePlayback(playback: PersistedPlayback): void {
    this.pendingPlayback = playback;
    if (this.playbackTimer !== null) return;

    this.playbackTimer = setTimeout(async () => {
      this.playbackTimer = null;
      const toSave = this.pendingPlayback;
      this.pendingPlayback = null;
      if (!toSave) return;
      try {
        await set(PLAYBACK_KEY, toSave);
      } catch (err) {
        console.error('[PersistenceService] failed to save playback', err);
      }
    }, PLAYBACK_DEBOUNCE_MS);
  }

  async savePlaybackNow(playback: PersistedPlayback): Promise<void> {
    if (this.playbackTimer !== null) {
      clearTimeout(this.playbackTimer);
      this.playbackTimer = null;
    }
    this.pendingPlayback = null;
    try {
      await set(PLAYBACK_KEY, playback);
    } catch (err) {
      console.error('[PersistenceService] failed to save playback (now)', err);
    }
  }

  async loadPlayback(): Promise<PersistedPlayback | null> {
    try {
      const playback = await get<PersistedPlayback>(PLAYBACK_KEY);
      return playback ?? null;
    } catch (err) {
      console.error('[PersistenceService] failed to load playback', err);
      return null;
    }
  }

  async clear(): Promise<void> {
    await this.clearState();
    await this.clearPlayback();
  }

  async clearState(): Promise<void> {
    await del(STATE_KEY);
  }

  async clearPlayback(): Promise<void> {
    await del(PLAYBACK_KEY);
  }

  /**
   * Для обратной совместимости с вызывающим кодом (playerPersistence.ts).
   * Возвращает Track как есть (idb-keyval умеет хранить FileSystemFileHandle).
   */
  toPersisted(track: Track): PersistedTrack {
    return track;
  }
}

export const persistenceService = PersistenceService.getInstance();
