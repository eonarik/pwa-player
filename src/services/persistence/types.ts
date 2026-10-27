// src/services/persistence/types.ts

import type { Track } from '@/types/track'

export interface PersistedTrack extends Track {
  folderId?: string
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
