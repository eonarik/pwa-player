// src/services/persistence/HistoryPersistenceService.ts

import { get, set, del } from 'idb-keyval';
import type { TrackId } from '@/types/ids';

const HISTORY_KEY = 'player:history';
const SAVE_DEBOUNCE_MS = 500;

interface PersistedHistoryEntry {
  trackId: TrackId;
  playedAt: number;
}

interface PersistedHistory {
  entries: PersistedHistoryEntry[];
  savedAt: number;
}

export class HistoryPersistenceService {
  private static instance: HistoryPersistenceService | null = null;

  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private pending: PersistedHistoryEntry[] | null = null;

  static getInstance(): HistoryPersistenceService {
    if (!HistoryPersistenceService.instance) {
      HistoryPersistenceService.instance = new HistoryPersistenceService();
    }
    return HistoryPersistenceService.instance;
  }

  save(entries: PersistedHistoryEntry[]): void {
    this.pending = entries;
    if (this.saveTimer !== null) return;

    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      const toSave = this.pending;
      this.pending = null;
      if (!toSave) return;
      void this.persistNow(toSave);
    }, SAVE_DEBOUNCE_MS);
  }

  async saveNow(entries: PersistedHistoryEntry[]): Promise<void> {
    if (this.saveTimer !== null) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    this.pending = null;
    await this.persistNow(entries);
  }

  private async persistNow(entries: PersistedHistoryEntry[]): Promise<void> {
    try {
      const payload: PersistedHistory = {
        entries,
        savedAt: Date.now(),
      };
      await set(HISTORY_KEY, payload);
    } catch (err) {
      console.error('[HistoryPersistenceService] failed to save', err);
    }
  }

  async flush(): Promise<void> {
    if (this.saveTimer !== null) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    const toSave = this.pending;
    this.pending = null;
    if (toSave) {
      await this.persistNow(toSave);
    }
  }

  async load(): Promise<PersistedHistoryEntry[] | null> {
    try {
      const data = await get<PersistedHistory>(HISTORY_KEY);
      return data?.entries ?? null;
    } catch (err) {
      console.error('[HistoryPersistenceService] failed to load', err);
      return null;
    }
  }

  async clear(): Promise<void> {
    if (this.saveTimer !== null) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    this.pending = null;
    await del(HISTORY_KEY);
  }
}

export const historyPersistenceService = HistoryPersistenceService.getInstance();
