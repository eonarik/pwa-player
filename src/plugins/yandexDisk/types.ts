// src/plugins/yandexDisk/types.ts

import type { TrackOrigin } from '@/types/library'

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
 * source не сохраняется — восстанавливается из remotePath.
 */
export interface PersistedYandexTrack {
  id: string
  pluginId: string
  folderId: string
  filename: string
  path: string
  remotePath: string
  title: string
  artist: string
  album: string
  origin?: TrackOrigin
  /** Длительность, если узнали (при воспроизведении или скачивании) */
  duration?: number
}

export interface PersistedYandexLibrary {
  folders: PersistedYandexFolder[]
  tracks: PersistedYandexTrack[]
  rootFolderId: string
  rootFolderName: string
  rootPath: string
  savedAt: number
}

export interface YandexConfig {
  hasSettings: boolean
  publicFolders: string[]
}

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
