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
  title: string
  artist: string
  album?: string
  /** Полный путь на Диске, если трек оттуда. Нужен для скачивания плейлиста. */
  remotePath?: string
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
