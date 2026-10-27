// src/types/playlist.ts

import type { TrackSnapshot } from './snapshot'

/**
 * Снимок метаданных трека на момент добавления в плейлист.
 *
 * Зачем снимок, а не просто trackId:
 * - Источник может стать недоступным (сменилась библиотека, потерян доступ к папке).
 * - Снимок позволяет показать пользователю, что было в плейлисте.
 * - remotePath нужен для скачивания плейлиста с Яндекс.Диска.
 */
export interface PlaylistTrackSnapshot extends TrackSnapshot {
  addedAt: number
}

export interface Playlist {
  id: string
  name: string
  /** Треки в порядке воспроизведения */
  tracks: PlaylistTrackSnapshot[]
  createdAt: number
  updatedAt: number
}

/** ID системного плейлиста «Избранное». Создаётся автоматически */
export const FAVORITES_PLAYLIST_ID = 'playlist:favorites'

/**
 * Универсальный формат трека для экспорта/импорта.
 * Используется в JSON и M3U.
 */
export interface PlaylistExportTrack {
  artist: string
  title: string
  album?: string
  duration?: number
  /** Для локальных файлов или специфичных плагинов */
  path?: string
}
