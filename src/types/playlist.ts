// src/types/playlist.ts

export interface Playlist {
  id: string
  name: string
  trackIds: string[]
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
  path?: string
}
