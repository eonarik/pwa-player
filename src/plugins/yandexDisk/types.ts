// src/plugins/yandexDisk/types.ts

import type { FileLocation, ScanState, TextFileRef } from '@/types/library'

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

export interface IYandexService {
  ping?(): Promise<boolean>
  login?(ctx: string, password: string): Promise<boolean>
  logout?(): void
  isDisconnected?(): boolean
  setDisconnected?(val: boolean): void
  isCancelled?(): boolean
  setCancelled?(val: boolean): void
  listResources(path: string): Promise<YandexResourcesResponse>
  buildDownloadUrl(path: string): string
  readTextFile(remotePath: string): Promise<YandexTextResponse | null>
  writeTextFile(remotePath: string, content: string): Promise<YandexWriteResponse>
}

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
  scanState?: ScanState
  textFiles?: TextFileRef[]

  /**
   * @deprecated Только для чтения старых кешей. Не пишется с 0.11.0.
   * Мигрируется в `scanState` в `fromPersisted`.
   */
  scanStatus?: 'scanned' | 'scanning'
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
  fileLocation?: FileLocation
  duration?: number

  /**
   * @deprecated Только для чтения старых кешей. Не пишется с 0.11.0.
   * Мигрируется в `fileLocation` в `fromPersisted`.
   */
  origin?: 'remote' | 'downloaded' | 'only-local'
}

export interface PersistedYandexLibrary {
  folders: PersistedYandexFolder[]
  tracks: PersistedYandexTrack[]
  rootFolderId: string
  rootFolderName: string
  rootPath: string
  savedAt: number
}
