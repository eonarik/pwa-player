// src/composables/useSoftTtlCache.ts

export interface CacheEntry<T> {
  key: string
  data: T
  fetchedAt: number
}

export interface CacheRead<T> {
  data: T
  fresh: boolean
}

export interface SoftTtlCacheOptions {
  /** Ключ в localStorage. */
  storageKey: string
  /** Время жизни «свежих» данных, мс. */
  ttlMs: number
}

export interface SoftTtlCache<T> {
  read(key: string): CacheRead<T> | null
  write(key: string, data: T): void
  clear(): void
}

/**
 * Soft-TTL кеш в localStorage.
 *
 * Особенности:
 * - Не удаляет просроченные записи (они нужны как fallback при ошибке сети).
 * - Single-entry: одна запись на ключ. Новый `write` перезаписывает.
 * - `read` возвращает `{ data, fresh }`. Если `fresh === false`, вызывающий
 *   должен попробовать обновить и при ошибке отдать `data`.
 */
export function useSoftTtlCache<T>(options: SoftTtlCacheOptions): SoftTtlCache<T> {
  const { storageKey, ttlMs } = options

  function read(key: string): CacheRead<T> | null {
    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) return null

      const parsed = JSON.parse(raw) as CacheEntry<T>
      if (!parsed || typeof parsed.fetchedAt !== 'number' || parsed.key !== key) {
        return null
      }

      const age = Date.now() - parsed.fetchedAt
      return { data: parsed.data, fresh: age < ttlMs }
    } catch {
      return null
    }
  }

  function write(key: string, data: T): void {
    try {
      const payload: CacheEntry<T> = { key, data, fetchedAt: Date.now() }
      localStorage.setItem(storageKey, JSON.stringify(payload))
    } catch (err) {
      console.warn(`[cache:${storageKey}] failed to write`, err)
    }
  }

  function clear(): void {
    try {
      localStorage.removeItem(storageKey)
    } catch {
      // ignore
    }
  }

  return { read, write, clear }
}
