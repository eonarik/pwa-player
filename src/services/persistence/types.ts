// src/services/persistence/types.ts

export interface PersistedTrack {
  id: string

  /** id плагина-источника: 'local', 'yandex', ... */
  pluginId: string

  title: string
  artist: string
  album: string
  year?: number
  trackNumber?: number
  genre?: string
  duration?: number
  codec?: string
  filename: string
  path?: string
  /** FileSystemFileHandle — сериализуется браузером */
  handle?: FileSystemFileHandle
  /** Хэндл директории — для восстановления обложек */
  directoryHandle?: FileSystemDirectoryHandle
  // coverUrl НЕ сохраняем — blob URL невалиден между сессиями
}

/**
 * Состояние плеера. НЕ включает currentTime —
 * позиция воспроизведения хранится отдельно (player:playback).
 */
export interface PersistedState {
  tracks: PersistedTrack[]
  currentIndex: number
  volume: number
  muted: boolean
  repeatMode: 'off' | 'one' | 'all'
  shuffle: boolean
  rootFolderName?: string
  savedAt: number
}

/**
 * Позиция воспроизведения. Хранится отдельно,
 * потому что меняется часто (10 раз в секунду).
 */
export interface PersistedPlayback {
  currentTime: number
  trackId: string | null
  savedAt: number
}
