// src/plugins/yandex/types.ts

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
  /** Всегда 'yandex' */
  pluginId: string
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

/**
 * Конфиг, который бэкенд отдаёт для Яндекс.Диска.
 */
export interface YandexConfig {
  hasSettings: boolean
  publicFolders: string[]
}

/**
 * Элемент ответа /api/disk/resources.
 */
export interface YandexItem {
  path: string
  name: string
  type: 'dir' | 'file'
  size?: number
  mime_type?: string
  media_type?: string
  created?: string
  modified?: string
  isAudio?: boolean
}

export interface YandexResourcesResponse {
  path: string
  total: number
  items: YandexItem[]
}
