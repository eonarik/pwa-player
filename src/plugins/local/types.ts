// src/plugins/local/types.ts

import type { PersistedTrack } from '@/services/persistence/types'

export type PersistedLocalTrack = PersistedTrack

export interface PersistedLocalFolder {
  id: string
  name: string
  parentId: string | null
  path: string
  handle?: FileSystemDirectoryHandle
  childFolderIds: string[]
  trackIds: string[]
  totalTrackCount: number
  source?: string
}

export interface PersistedLocalLibrary {
  folders: PersistedLocalFolder[]
  tracks: PersistedLocalTrack[]
  rootFolderId: string
  rootFolderName: string
  savedAt: number
}
