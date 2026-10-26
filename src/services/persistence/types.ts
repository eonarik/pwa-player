// src/services/persistence/types.ts

import type { FileLocation, RawMetadata } from '@/types/library'

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
  source?: string
  coverUrl?: string
  fileLocation?: FileLocation
  raw?: RawMetadata
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
