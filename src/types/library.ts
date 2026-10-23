// src/types/library.ts

import type { Track } from './track'

/**
 * Где физически находится файл трека.
 *
 * - `nowhere`     — нет ни в облаке, ни локально (трек-призрак, ошибка скана).
 * - `remote-only` — есть в облаке, локальной копии нет.
 * - `local-only`  — есть на устройстве, в облаке нет (или ещё не проверяли).
 * - `both`        — есть в облаке и скачан.
 *
 * Инварианты:
 * - `'both' | 'local-only'` ⇒ `track.source instanceof File`.
 * - `'remote-only'`         ⇒ `track.source` — строка (URL или пустая).
 * - `'nowhere'`             ⇒ `track.source` — пустая строка.
 *
 * Проверяется в dev-режиме в `assertTrackInvariants`.
 */
export type FileLocation = 'nowhere' | 'remote-only' | 'local-only' | 'both'

/**
 * Состояние сканирования ОДНОЙ папки (не поддерева).
 *
 * - `pending`  — сканирование ещё не начиналось.
 * - `scanning` — идёт `listResources` для этой папки.
 * - `scanned`  — `listResources` отработал, список детей/треков актуален.
 * - `error`    — последний `listResources` упал.
 *
 * «Готово ли поддерево» — вычисляется через `isSubtreeScanned(folderId)`.
 */
export type ScanState = 'pending' | 'scanning' | 'scanned' | 'error'

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
  /** Состояние сканирования этой папки. */
  scanState?: ScanState
  /** Текстовые файлы (.txt) в папке */
  textFiles?: TextFileRef[]
}

export interface LibraryTrack extends Track {
  folderId: string
  handle?: FileSystemFileHandle
  remotePath?: string
  /** Где физически находится файл. */
  fileLocation?: FileLocation
}

export interface CollectedLibrary {
  folders: Folder[]
  tracks: LibraryTrack[]
  rootFolderId: string
  rootFolderName: string
}
