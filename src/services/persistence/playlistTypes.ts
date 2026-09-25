// src/services/persistence/playlistTypes.ts

import type { Playlist } from '@/types/playlist'

/**
 * Состояние плейлистов в IDB.
 * Массив, потому что Vue/Pinia легче работать с массивом + индексировать по id.
 */
export interface PersistedPlaylists {
  playlists: Playlist[]
  savedAt: number
}
