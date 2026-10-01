// src/plugins/local/types.ts

/**
 * Сохранённая папка локальной библиотеки.
 * handle сериализуется браузером в IDB нативно.
 * Для искусственного контейнера (source = 'local', parentId = null)
 * handle отсутствует.
 */
export interface PersistedLocalFolder {
  id: string
  name: string
  parentId: string | null
  path: string
  handle?: FileSystemDirectoryHandle
  childFolderIds: string[]
  trackIds: string[]
  totalTrackCount: number
  /** source root: 'local' (контейнер) или 'local:Music' (папка) */
  source?: string
}

/**
 * Сохранённый трек локальной библиотеки.
 * source (File) НЕ сохраняется — восстанавливается через handle.getFile().
 * coverUrl (blob URL) НЕ сохраняется — невалиден между сессиями.
 */
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
}

export interface PersistedLocalLibrary {
  folders: PersistedLocalFolder[]
  tracks: PersistedLocalTrack[]
  rootFolderId: string
  rootFolderName: string
  savedAt: number
}
