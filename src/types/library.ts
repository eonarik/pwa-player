// src/types/library.ts

import type { Track } from './track'

export type TrackOrigin = 'remote' | 'downloaded' | 'only-local'

export type ScanStatus = 'scanned' | 'scanning'

/** Ссылка на текстовый файл (.txt) внутри папки. */
export interface TextFileRef {
  name: string
  /** Полный путь в источнике */
  remotePath: string
  /** Путь внутри корня источника */
  path: string
}

export interface Folder {
  id: string
  name: string
  parentId: string | null
  path: string
  handle?: FileSystemDirectoryHandle
  childFolderIds: string[]
  trackIds: string[]
  totalTrackCount: number
  /** Общее число .txt-файлов во всём поддереве */
  totalTextFileCount?: number
  /** id плагина-источника */
  source?: string
  /** Полный путь в источнике. Нужен для точечного обновления. */
  remotePath?: string
  scanStatus?: ScanStatus
  ready?: boolean
  /** Текстовые файлы (.txt) в папке */
  textFiles?: TextFileRef[]
}

export interface LibraryTrack extends Track {
  folderId: string
  handle?: FileSystemFileHandle
  remotePath?: string
  origin?: TrackOrigin
}

export interface CollectedLibrary {
  folders: Folder[]
  tracks: LibraryTrack[]
  rootFolderId: string
  rootFolderName: string
}
