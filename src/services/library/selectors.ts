// src/services/library/selectors.ts

import type { Track } from '@/types'
import type { Folder, LibraryTrack } from '@/types/library'
import type { Playability } from '@/types/playability'

export interface PlayabilityContext {
  isPluginDisconnected: boolean
  isDownloading: boolean
}

/**
 * Можно ли воспроизвести трек прямо сейчас.
 *
 * Чистая функция: одинаковый вход → одинаковый выход. Не читает глобальное
 * состояние. Легко тестируется.
 */
export function getPlayability(
  track: LibraryTrack | null | undefined,
  ctx: PlayabilityContext,
): Playability {
  if (!track) return 'missing'

  const location = track.fileLocation ?? 'remote-only'

  if (ctx.isDownloading) return 'downloading'

  if (location === 'nowhere') return 'missing'

  if (location === 'local-only' || location === 'both') {
    return track.handle ? 'playable' : 'unavailable'
  }

  // remote-only
  const hasSourceString = typeof track.source === 'string' && track.source.length > 0
  if (!hasSourceString) return 'missing'
  if (ctx.isPluginDisconnected) return 'needs-reconnect'

  return 'playable-streaming'
}

/**
 * Есть ли у трека локальная копия (можно слушать без сети).
 * Для `TrackRow` (полоска), для `BatchDownloadButton` (pending), для
 * `TrackActions` (пункт «Удалить с устройства»).
 */
export function isLocalTrack(track: LibraryTrack | null | undefined): boolean {
  if (!track) return false
  const location = track.fileLocation ?? 'remote-only'
  return location === 'local-only' || location === 'both'
}

/**
 * Есть ли трек в облаке (для `missing` в синхронизации,
 * для `removeMissing` в mergeFolderContent).
 */
export function isRemoteTrack(track: LibraryTrack | null | undefined): boolean {
  if (!track) return false
  const location = track.fileLocation ?? 'remote-only'
  return location === 'remote-only' || location === 'both'
}

/**
 * Готово ли поддерево (эта папка + все потомки просканированы).
 *
 * Заменяет `folder.ready`. Вычисляется на лету; если вызывается часто —
 * `library` кэширует результат (см. `invalidateSubtreeScanned`).
 *
 * Чистая функция от `getFolder` — легко тестируется, не зависит от store.
 */
export function isSubtreeScanned(
  folderId: string,
  getFolder: (id: string) => Folder | null,
): boolean {
  const visited = new Set<string>()

  const walk = (id: string): boolean => {
    if (visited.has(id)) return true
    visited.add(id)

    const folder = getFolder(id)
    if (!folder) return true // нет папки — считаем готовой (её нет)

    const state = folder.scanState ?? 'pending'
    if (state !== 'scanned') return false

    for (const childId of folder.childFolderIds) {
      if (!walk(childId)) return false
    }
    return true
  }

  return walk(folderId)
}

/**
 * Трек недоступен для воспроизведения: нет ни `handle` (локальный файл),
 * ни `source` (URL стриминга).
 *
 * Используется в `player` для блокировки воспроизведения и в UI для
 * индикации «Источник недоступен». Не зависит от контекста (сессия, сеть),
 * только от данных самого трека.
 */
export function isTrackUnavailable(track: Track | LibraryTrack | null | undefined): boolean {
  if (!track) return true
  if (track.handle) return false
  if (typeof track.source === 'string' && track.source.length > 0) return false
  return true
}
