// src/stores/library/subtreeCache.ts

import type { Folder } from '@/types/library'
import { SubtreeScannedCache } from '@/services/library/subtreeCache'

/**
 * Кэш `isSubtreeScanned` на уровне приложения.
 *
 * Модульный, а не в `defineStore`, потому что `createLibraryWriter`
 * (и его helpers) живёт вне store и должен инвалидировать кэш.
 * Pinia — синглтон, значит один кэш на приложение.
 *
 * В тестах сбрасывается через `useLibraryStore().clear()`.
 */
export const subtreeCache = new SubtreeScannedCache()

export function invalidateSubtreeCache(
  folderId: string,
  getFolder: (id: string) => Folder | null,
): void {
  subtreeCache.invalidate(folderId, getFolder)
}

export function clearSubtreeCache(): void {
  subtreeCache.clear()
}

export { SubtreeScannedCache }
