// src/services/persistence/libraryTypes.ts

/**
 * Сохранённая папка.
 * handle сериализуется браузером в IDB нативно.
 */
export interface PersistedFolder {
  id: string
  name: string
  parentId: string | null
  path: string
  handle: FileSystemDirectoryHandle
  childFolderIds: string[]
  trackIds: string[]
  totalTrackCount: number
}

/**
 * Сохранённый трек.
 * source (File) НЕ сохраняется — он тяжёлый и устаревает.
 * Восстанавливается через handle.getFile() при загрузке.
 * coverUrl (blob URL) НЕ сохраняется — невалиден между сессиями.
 */
export interface PersistedTrack {
  id: string
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
  handle: FileSystemFileHandle
}

export interface PersistedLibrary {
  folders: PersistedFolder[]
  tracks: PersistedTrack[]
  rootFolderId: string
  rootFolderName: string
  savedAt: number
}
