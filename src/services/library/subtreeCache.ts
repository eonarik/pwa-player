// src/services/library/subtreeCache.ts

import type { Folder } from '@/types/library'

/**
 * Простой кэш `folderId → isSubtreeScanned`. Не реактивный сам по себе —
 * `library` пересчитывает computed при инвалидации.
 *
 * Инвалидация: при `updateFolder` / `addFolders` / `removeFolders` /
 * `setLibrary` — сбросить папку и всех её предков (потому что готовность
 * поддерева зависит от детей).
 */
export class SubtreeScannedCache {
  private cache = new Map<string, boolean>()

  get(folderId: string): boolean | undefined {
    return this.cache.get(folderId)
  }

  set(folderId: string, value: boolean): void {
    this.cache.set(folderId, value)
  }

  /**
   * Инвалидирует папку и всех её предков. Предки зависят от детей,
   * поэтому их закэшированное значение больше не действительно.
   */
  invalidate(folderId: string, getFolder: (id: string) => Folder | null): void {
    let current: string | null = folderId
    const visited = new Set<string>()

    while (current && !visited.has(current)) {
      visited.add(current)
      this.cache.delete(current)
      const folder = getFolder(current)
      current = folder?.parentId ?? null
    }
  }

  clear(): void {
    this.cache.clear()
  }
}
