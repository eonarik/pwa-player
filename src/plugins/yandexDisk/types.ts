// src/plugins/yandexDisk/types.ts

import type { ScanStatus, TextFileRef, TrackOrigin } from '@/types/library'

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
  totalTextFileCount?: number
  scanStatus?: ScanStatus
  ready?: boolean
  textFiles?: TextFileRef[]
}

/**
 * Сохранённый трек Яндекс.Диска.
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
