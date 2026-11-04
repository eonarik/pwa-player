// src/services/covers/CoverBlobCache.ts

import { get, set, del } from 'idb-keyval';
import type { AlbumId } from '@/types/ids';

const STORAGE_KEY = 'player:coverBlobs';

/**
 * Кеш blob-обложек из ID3 (не http).
 *
 * Ключ — albumId. Значение — Blob.
 *
 * Album.coverUrl для таких обложек остаётся null. UI получает blob
 * через useAlbumCover(albumId), который читает этот кеш.
 *
 * Зачем отдельный IDB-store (не в albumService):
 * - Blob нельзя JSON.stringify → нельзя в albumService.saveAll.
 * - Album.coverUrl — только http(s) или null, без "idb://" схемы.
 */
class CoverBlobCacheService {
  private static instance: CoverBlobCacheService | null = null;

  private inMemory = new Map<AlbumId, Blob>();
  private objectUrls = new Map<AlbumId, string>();
  private isLoaded = false;
  private loadPromise: Promise<void> | null = null;

  static getInstance(): CoverBlobCacheService {
    if (!CoverBlobCacheService.instance) {
      CoverBlobCacheService.instance = new CoverBlobCacheService();
    }
    return CoverBlobCacheService.instance;
  }

  async load(): Promise<void> {
    if (this.isLoaded) return;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = (async () => {
      try {
        const data = await get<Record<string, Blob>>(STORAGE_KEY);
        if (data) {
          for (const [albumId, blob] of Object.entries(data)) {
            this.inMemory.set(albumId as AlbumId, blob);
          }
        }
        this.isLoaded = true;
      } catch (err) {
        console.error('[coverBlobCache] failed to load', err);
        this.isLoaded = true;
      } finally {
        this.loadPromise = null;
      }
    })();

    return this.loadPromise;
  }

  /**
   * Возвращает blob для альбома (из in-memory кеша).
   * Если нужно — предварительно вызывает load().
   */
  get(albumId: AlbumId): Blob | null {
    return this.inMemory.get(albumId) ?? null;
  }

  /**
   * Возвращает object URL для blob. Кеширует URL на всё время жизни blob.
   */
  getObjectUrl(albumId: AlbumId): string | null {
    const existing = this.objectUrls.get(albumId);
    if (existing) return existing;

    const blob = this.inMemory.get(albumId);
    if (!blob) return null;

    const url = URL.createObjectURL(blob);
    this.objectUrls.set(albumId, url);
    return url;
  }

  async put(albumId: AlbumId, blob: Blob): Promise<void> {
    this.inMemory.set(albumId, blob);

    const oldUrl = this.objectUrls.get(albumId);
    if (oldUrl) {
      URL.revokeObjectURL(oldUrl);
      this.objectUrls.delete(albumId);
    }

    try {
      await this.persist();
    } catch (err) {
      console.warn('[coverBlobCache] failed to persist', err);
    }
  }

  async delete(albumId: AlbumId): Promise<void> {
    if (!this.inMemory.has(albumId)) return;
    this.inMemory.delete(albumId);

    const url = this.objectUrls.get(albumId);
    if (url) {
      URL.revokeObjectURL(url);
      this.objectUrls.delete(albumId);
    }

    try {
      await this.persist();
    } catch (err) {
      console.warn('[coverBlobCache] failed to persist (delete)', err);
    }
  }

  async clear(): Promise<void> {
    for (const url of this.objectUrls.values()) {
      URL.revokeObjectURL(url);
    }
    this.objectUrls.clear();
    this.inMemory.clear();

    try {
      await del(STORAGE_KEY);
    } catch (err) {
      console.warn('[coverBlobCache] failed to clear', err);
    }
  }

  size(): number {
    return this.inMemory.size;
  }

  private async persist(): Promise<void> {
    const obj: Record<string, Blob> = {};
    for (const [albumId, blob] of this.inMemory.entries()) {
      obj[albumId] = blob;
    }
    await set(STORAGE_KEY, obj);
  }
}

export const coverBlobCache = CoverBlobCacheService.getInstance();
