// src/services/persistence/AlbumService.ts

import { get, set, del } from 'idb-keyval';
import { deepToRaw } from '@/utils/deepToRaw';
import type { Album } from '@/types/album';
import type { AlbumId } from '@/types/ids';
import { telemetry } from '@/services/telemetry';

const STORAGE_KEY = 'player:albums';
const SAVE_DEBOUNCE_MS = 500;

export class AlbumService {
  private static instance: AlbumService | null = null;

  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private pending: Record<AlbumId, Album> | null = null;

  static getInstance(): AlbumService {
    if (!AlbumService.instance) {
      AlbumService.instance = new AlbumService();
    }
    return AlbumService.instance;
  }

  async loadAll(): Promise<Record<AlbumId, Album>> {
    try {
      const data = await get<Record<AlbumId, Album>>(STORAGE_KEY);
      return data ?? ({} as Record<AlbumId, Album>);
    } catch (err) {
      console.error('[albums] failed to load', err);
      return {} as Record<AlbumId, Album>;
    }
  }

  save(albums: Record<AlbumId, Album>): void {
    this.pending = albums;
    if (this.saveTimer !== null) return;

    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      const toSave = this.pending;
      this.pending = null;
      if (!toSave) return;
      void this.persistNow(toSave);
    }, SAVE_DEBOUNCE_MS);
  }

  async saveNow(albums: Record<AlbumId, Album>): Promise<void> {
    if (this.saveTimer !== null) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    this.pending = null;
    await this.persistNow(albums);
  }

  private async persistNow(albums: Record<AlbumId, Album>): Promise<void> {
    try {
      const raw = deepToRaw(albums);
      const plain = structuredClone(raw);

      const approxSizeKB =
        JSON.stringify(plain, (_key, value) => (value instanceof Blob ? '<blob>' : value)).length / 1024;
      telemetry.event('idb.write', { key: STORAGE_KEY, sizeKB: Math.round(approxSizeKB) });

      await set(STORAGE_KEY, plain);
    } catch (err) {
      console.error('[albums] failed to save', err);
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

  async clear(): Promise<void> {
    if (this.saveTimer !== null) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    this.pending = null;
    try {
      await del(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}

export const albumService = AlbumService.getInstance();
