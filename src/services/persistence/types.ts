// src/services/persistence/types.ts
export interface PersistedTrack {
  id: string
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
  // coverUrl НЕ сохраняем — blob URL невалиден между сессиями
  directoryHandle?: FileSystemDirectoryHandle
}

export interface PersistedState {
  tracks: PersistedTrack[]
  currentIndex: number
  currentTime: number
  volume: number
  muted: boolean
  repeatMode: 'off' | 'one' | 'all'
  shuffle: boolean
  rootFolderName?: string
  savedAt: number
}
