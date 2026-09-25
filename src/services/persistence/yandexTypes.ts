// src/services/persistence/yandexTypes.ts

/**
 * Сохранённая папка Яндекс.Диска.
 * Нет handle — у Диска его нет.
 */
export interface PersistedYandexFolder {
  id: string
  name: string
  parentId: string | null
  path: string
  remotePath: string
  childFolderIds: string[]
  trackIds: string[]
  totalTrackCount: number
}

/**
 * Сохранённый трек Яндекс.Диска.
 * source не сохраняется — восстанавливается из remotePath через buildDownloadUrl().
 */
export interface PersistedYandexTrack {
  id: string
  folderId: string
  filename: string
  path: string
  remotePath: string
  title: string
  artist: string
  album: string
}

export interface PersistedYandexLibrary {
  folders: PersistedYandexFolder[]
  tracks: PersistedYandexTrack[]
  rootFolderId: string
  rootFolderName: string
  rootPath: string
  savedAt: number
}
