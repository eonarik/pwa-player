// src/services/persistence/MetadataPersistenceService.ts

import { get, set, del } from 'idb-keyval'

const METADATA_KEY = 'player:metadata'

export interface OriginalMetadata {
  artist: string
  title: string
  album: string
  coverUrl: string | undefined
  /** Был ли coverUrl blob-URL (тогда не восстанавливаем — blob мог умереть) */
  coverUrlWasBlob: boolean
}

export interface MetadataCacheEntry {
  trackId: string
  /** Найденные метаданные */
  artist: string | null
  title: string | null
  album: string | null
  coverUrl: string | null
  /** Когда искали */
  fetchedAt: number
  /** Similarity с исходным треком (0..1). null, если artist исходного был пуст. */
  similarity: number | null
  /** Оригинальные метаданные до применения (для отката). null, если не применяли. */
  original: OriginalMetadata | null
}

const NOT_FOUND_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 дней

export class MetadataPersistenceService {
  private static instance: MetadataPersistenceService | null = null

  private cache: Map<string, MetadataCacheEntry> = new Map()
  private isLoaded = false

  static getInstance(): MetadataPersistenceService {
    if (!MetadataPersistenceService.instance) {
      MetadataPersistenceService.instance = new MetadataPersistenceService()
    }
    return MetadataPersistenceService.instance
  }

  async load(): Promise<void> {
    if (this.isLoaded) return
    try {
      const data = await get<Record<string, MetadataCacheEntry>>(METADATA_KEY)
      if (data) {
        for (const [trackId, entry] of Object.entries(data)) {
          this.cache.set(trackId, entry)
        }
      }
      this.isLoaded = true
      console.info(`[MetadataPersistence] loaded ${this.cache.size} entries`)
    } catch (err) {
      console.error('[MetadataPersistence] failed to load', err)
    }
  }

  get(trackId: string): MetadataCacheEntry | undefined {
    const entry = this.cache.get(trackId)
    if (!entry) return undefined

    if (entry.artist === null && Date.now() - entry.fetchedAt > NOT_FOUND_TTL_MS) {
      return undefined
    }

    return entry
  }

  has(trackId: string): boolean {
    return this.get(trackId) !== undefined
  }

  setInMemory(
    trackId: string,
    data: {
      artist: string | null
      title: string | null
      album: string | null
      coverUrl: string | null
      similarity: number | null
      original: OriginalMetadata | null
    },
  ): void {
    this.cache.set(trackId, {
      trackId,
      ...data,
      fetchedAt: Date.now(),
    })
  }

  async flush(): Promise<void> {
    await this.persist()
  }

  async resetForTracks(trackIds: string[]): Promise<void> {
    let changed = false
    for (const trackId of trackIds) {
      if (this.cache.delete(trackId)) changed = true
    }
    if (changed) {
      await this.persist()
    }
  }

  async clear(): Promise<void> {
    this.cache.clear()
    try {
      await del(METADATA_KEY)
    } catch (err) {
      console.error('[MetadataPersistence] failed to clear', err)
    }
  }

  size(): number {
    return this.cache.size
  }

  private async persist(): Promise<void> {
    try {
      const obj: Record<string, MetadataCacheEntry> = {}
      for (const [trackId, entry] of this.cache.entries()) {
        obj[trackId] = entry
      }
      await set(METADATA_KEY, obj)
    } catch (err) {
      console.error('[MetadataPersistence] failed to persist', err)
    }
  }
}

export const metadataPersistenceService = MetadataPersistenceService.getInstance()
