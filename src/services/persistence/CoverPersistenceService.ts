// src/services/persistence/CoverPersistenceService.ts

import { get, set, del } from 'idb-keyval'

const COVER_KEY = 'player:covers'

export interface CoverCacheEntry {
  trackId: string
  /** URL обложки (Deezer/iTunes CDN) или null, если искали и не нашли */
  coverUrl: string | null
  /** Когда искали. Нужно, чтобы «не найдено» можно было перепроверить позже */
  fetchedAt: number
}

/** TTL для «не найдено». Успешные результаты кэшируются навсегда. */
const NOT_FOUND_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 дней

export class CoverPersistenceService {
  private static instance: CoverPersistenceService | null = null

  private cache: Map<string, CoverCacheEntry> = new Map()
  private isLoaded = false

  static getInstance(): CoverPersistenceService {
    if (!CoverPersistenceService.instance) {
      CoverPersistenceService.instance = new CoverPersistenceService()
    }
    return CoverPersistenceService.instance
  }

  /**
   * Загружает кэш из IDB в память. Вызывать при старте приложения.
   */
  async load(): Promise<void> {
    if (this.isLoaded) return
    try {
      const data = await get<Record<string, CoverCacheEntry>>(COVER_KEY)
      if (data) {
        for (const [trackId, entry] of Object.entries(data)) {
          this.cache.set(trackId, entry)
        }
      }
      this.isLoaded = true
      console.info(`[CoverPersistence] loaded ${this.cache.size} entries`)
    } catch (err) {
      console.error('[CoverPersistence] failed to load', err)
    }
  }

  /**
   * Получить кэшированную обложку.
   * - `undefined` — не искали.
   * - `null` — искали, не нашли.
   * - `string` — URL обложки.
   */
  get(trackId: string): string | null | undefined {
    const entry = this.cache.get(trackId)
    if (!entry) return undefined

    // Если это «не найдено» и TTL истёк — считаем, что не искали
    if (entry.coverUrl === null && Date.now() - entry.fetchedAt > NOT_FOUND_TTL_MS) {
      return undefined
    }

    return entry.coverUrl
  }

  /** Сохранить результат поиска (включая null) */
  async set(trackId: string, coverUrl: string | null): Promise<void> {
    this.cache.set(trackId, {
      trackId,
      coverUrl,
      fetchedAt: Date.now(),
    })
    await this.persist()
  }

  /** Массовое сохранение — эффективнее, чем set по одному */
  async setMany(entries: Array<{ trackId: string; coverUrl: string | null }>): Promise<void> {
    const now = Date.now()
    for (const { trackId, coverUrl } of entries) {
      this.cache.set(trackId, {
        trackId,
        coverUrl,
        fetchedAt: now,
      })
    }
    await this.persist()
  }

  /**
   * Сбрасывает записи со значением null (те, что искали, но не нашли).
   * Если trackIds не передан — сбрасывает все null-записи.
   */
  async resetNotFound(trackIds?: string[]): Promise<void> {
    const toReset = trackIds ?? Array.from(this.cache.keys())
    let changed = false

    for (const trackId of toReset) {
      const entry = this.cache.get(trackId)
      if (entry && entry.coverUrl === null) {
        this.cache.delete(trackId)
        changed = true
      }
    }

    if (changed) {
      await this.persist()
    }
  }

  /**
   * Удаляет записи из кэша для указанных треков.
   * Используется для «Сбросить» — чтобы переискать обложки с нуля.
   */
  async resetForTracks(trackIds: string[]): Promise<void> {
    let changed = false
    for (const trackId of trackIds) {
      if (this.cache.delete(trackId)) changed = true
    }
    if (changed) {
      await this.persist()
    }
  }

  /** Сколько треков из переданных уже проверено (есть запись, не важно null или URL) */
  countChecked(trackIds: string[]): number {
    let count = 0
    for (const id of trackIds) {
      if (this.cache.has(id)) count++
    }
    return count
  }

  /** Сколько треков из переданных имеет URL (не null) */
  countFound(trackIds: string[]): number {
    let count = 0
    for (const id of trackIds) {
      const entry = this.cache.get(id)
      if (entry && entry.coverUrl !== null) count++
    }
    return count
  }

  private async persist(): Promise<void> {
    try {
      const obj: Record<string, CoverCacheEntry> = {}
      for (const [trackId, entry] of this.cache.entries()) {
        obj[trackId] = entry
      }
      await set(COVER_KEY, obj)
    } catch (err) {
      console.error('[CoverPersistence] failed to persist', err)
    }
  }

  /** Очистить кэш */
  async clear(): Promise<void> {
    this.cache.clear()
    try {
      await del(COVER_KEY)
    } catch (err) {
      console.error('[CoverPersistence] failed to clear', err)
    }
  }

  /** Сколько записей в кэше */
  size(): number {
    return this.cache.size
  }
}

export const coverPersistenceService = CoverPersistenceService.getInstance()
