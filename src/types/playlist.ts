// src/types/playlist.ts

/**
 * Снимок метаданных трека на момент добавления в плейлист.
 *
 * Зачем снимок, а не просто trackId:
 * - Источник может стать недоступным (сменилась библиотека, потерян доступ к папке).
 * - Снимок позволяет показать пользователю, что было в плейлисте.
 * - remotePath нужен для скачивания плейлиста с Яндекс.Диска.
 */
export interface PlaylistTrackSnapshot {
  /** Полный trackId в формате библиотеки: 'track:yandex:disk:/...' */
  trackId: string

  /** id плагина-источника: 'local', 'yandex', ... */
  pluginId: string

  title: string
  artist: string
  album?: string
  duration?: number
  coverUrl?: string
  /** Полный путь на Диске, если трек оттуда. Нужен для скачивания плейлиста. */
  remotePath?: string
  source?: string
  /** Когда добавлен в плейлист */
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
