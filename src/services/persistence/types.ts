// src/services/persistence/types.ts

export interface PersistedTrack {
  id: string
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
  handle?: FileSystemFileHandle
  directoryHandle?: FileSystemDirectoryHandle
  /** URL потока (для радио или стриминга) */
  source?: string
  /** URL обложки (если это не blob, а внешняя ссылка) */
  coverUrl?: string
}

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

export interface PersistedPlayback {
  currentTime: number
  trackId: string | null
  savedAt: number
}
