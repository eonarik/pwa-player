// src/types/track.ts

import type { FileLocation, RawMetadata, MetadataSource } from './library'

export interface TrackSource {
  id: string
  pluginId: string
  url?: string
  priority: number
}

export interface Track {
  id: string
  pluginId: string

  // --- Метаданные ---
  title: string
  artist: string
  album?: string
  year?: number
  trackNumber?: number
  genre?: string
  duration?: number
  codec?: string

  /**
   * URL обложки. Используется ТОЛЬКО для стриминга без альбомов (радио, подкасты).
   * Для локальных и облачных треков обложка всегда берется из Album.
   */
  coverUrl?: string

  metaSource?: MetadataSource
  hasId3Tags?: boolean
  raw?: RawMetadata

  albumId?: string
  isVirtual?: boolean

  sources: TrackSource[]

  handle?: FileSystemFileHandle
  directoryHandle?: FileSystemDirectoryHandle

  filename?: string
  path?: string
  remotePath?: string
  fileLocation?: FileLocation
}
