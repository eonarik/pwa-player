// src/services/persistence/AlbumService.ts

import { get, set, del } from 'idb-keyval';
import { toRaw } from 'vue';
import type { Album } from '@/types/album';
import type { AlbumId } from '@/types/ids';

const STORAGE_KEY = 'player:albums';

export class AlbumService {
  private static instance: AlbumService | null = null;

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

  async saveAll(albums: Record<AlbumId, Album>): Promise<void> {
    try {
      const rawAlbums = toRaw(albums);
      const plain = JSON.parse(JSON.stringify(rawAlbums));
      await set(STORAGE_KEY, plain);
    } catch (err) {
      console.error('[albums] failed to save', err);
    }
  }

  async clear(): Promise<void> {
    try {
      await del(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}

export const albumService = AlbumService.getInstance();
