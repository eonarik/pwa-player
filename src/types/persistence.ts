// src/types/persistence.ts

import type { FileLocation, RawMetadata, MetadataSource } from './library'

/**
 * Единый тип для сохранения трека в IndexedDB.
 * Покрывает плеер, локальные папки и Яндекс.Диск.
 */
export interface PersistedTrack {
  id: string
  pluginId: string
  title: string
  artist: string
  album: string

  // Метаданные
  year?: number
  trackNumber?: number
  genre?: string
  duration?: number
  codec?: string
  coverUrl?: string
  metaSource?: MetadataSource
  hasId3Tags?: boolean
  raw?: RawMetadata

  // Локация и пути
  filename: string
  path?: string
  remotePath?: string
  fileLocation?: FileLocation

  // Файловые хэндлы
  handle?: FileSystemFileHandle
  directoryHandle?: FileSystemDirectoryHandle

  // Стриминг
  source?: string
}
