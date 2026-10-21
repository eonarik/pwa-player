// src/plugins/yandexDisk/types.ts

import type { ScanStatus, TextFileRef, TrackOrigin } from '@/types/library'

// --- Типы ответов API Яндекс.Диска ---

export interface YandexResourceItem {
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
  items: YandexResourceItem[]
  _embedded?: {
    items: YandexResourceItem[]
  }
}

export interface YandexTextResponse {
  content: string
  modified: string | null
  size: number | null
}

export interface YandexWriteResponse {
  ok: boolean
  modified: string | null
}

export interface YandexDownloadResponse {
  relativePath: string
  size: number
}

// --- Интерфейс сервиса ---

export interface IYandexService {
  ping?(): Promise<boolean>
  login?(ctx: string, password: string): Promise<boolean>
  checkContext?(ctx: string): Promise<boolean>
  logout?(): void
  listResources(path: string): Promise<YandexResourcesResponse>
  buildDownloadUrl(path: string): string
  readTextFile(remotePath: string): Promise<YandexTextResponse | null>
  writeTextFile(remotePath: string, content: string): Promise<YandexWriteResponse>
}

// --- Типы для Persistence ---

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
