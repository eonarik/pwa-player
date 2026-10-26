// src/plugins/local/types.ts

import type { MetadataSource, RawMetadata } from '@/types/library'

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

export interface PersistedLocalTrack {
  id: string
  pluginId: string
  folderId: string
  title: string
  artist: string
  album: string
  year?: number
  trackNumber?: number
  genre?: string
  duration?: number
  codec?: string
  filename: string
  path: string
  handle?: FileSystemFileHandle
  metaSource?: MetadataSource
  raw?: RawMetadata
}

export interface PersistedLocalLibrary {
  folders: PersistedLocalFolder[]
  tracks: PersistedLocalTrack[]
  rootFolderId: string
  rootFolderName: string
  savedAt: number
}
