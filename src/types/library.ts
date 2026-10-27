// src/types/library.ts

import type { Track } from './track'

export type FileLocation = 'nowhere' | 'remote-only' | 'local-only' | 'both'
export type ScanState = 'pending' | 'scanning' | 'scanned' | 'error'
export type MetadataSource = 'manual' | 'file' | 'auto' | 'filename' | 'unknown'

export interface TextFileRef {
  name: string
  remotePath: string
  path: string
}

export interface Folder {
  id: string
  name: string
  parentId: string | null
  path: string
  handle?: FileSystemDirectoryHandle
  childFolderIds: string[]
  trackIds: string[]
  totalTrackCount: number
  totalTextFileCount?: number
  source?: string
  remotePath?: string
  scanState?: ScanState
  textFiles?: TextFileRef[]
}

export interface RawMetadata {
  title: string
  artist: string
  album: string
  coverUrl?: string
  hasId3Tags?: boolean
}

export interface Album {
  id: string
  name: string
  artist: string
  coverUrl?: string
  trackIds: string[]
}

export interface LibraryTrack extends Track {
  folderId: string
}

export interface CollectedLibrary {
  folders: Folder[]
  tracks: LibraryTrack[]
  albums?: Album[]
  rootFolderId: string
  rootFolderName: string
}
