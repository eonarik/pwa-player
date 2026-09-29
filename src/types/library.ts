// src/types/library.ts

import type { Track } from './track'

/**
 * Происхождение трека в источнике.
 * - 'remote'     — трек есть в источнике, локальной копии нет
 * - 'downloaded' — трек есть в источнике и скачан на устройство
 * - 'only-local' — файл есть только в папке скачивания, в источнике его нет
 */
export type TrackOrigin = 'remote' | 'downloaded' | 'only-local'

/**
 * Статус обхода папки.
 * - undefined    — ещё не обходили
 * - 'scanning'   — обход идёт прямо сейчас
 * - 'scanned'    — обход завершён
 */
export type ScanStatus = 'scanned' | 'scanning'

/**
 * Папка в библиотеке.
 * Хранится в нормализованном виде: parentId + childFolderIds + trackIds.
 */
export interface Folder {
  id: string
  name: string
  parentId: string | null
  /** Путь внутри корня выбранной папки. Для корня — '' */
  path: string
  /**
   * Хэндл директории — для повторного доступа и поиска обложек.
   * Опциональный: у папок из Яндекс.Диска его нет.
   */
  handle?: FileSystemDirectoryHandle
  /** id подпапок в порядке добавления */
  childFolderIds: string[]
  /** id треков в порядке сортировки (по имени файла) */
  trackIds: string[]
  /** Общее число треков во всём поддереве (для отображения) */
  totalTrackCount: number
  /** id плагина-источника: 'local', 'yandex', ... */
  source?: string
  /**
   * Полный путь на Яндекс.Диске: 'disk:/все,что наше/loGii3026/...'.
   * Заполняется только для папок из Диска. Нужен для точечного обновления.
   */
  remotePath?: string
  /**
   * Статус обхода самой папки.
   * undefined — ещё не обходили, scanned — обход завершён, scanning — идёт.
   */
  scanStatus?: ScanStatus
  /**
   * Готово ли всё поддерево (сама папка + все подпапки).
   * true — можно показывать totalTrackCount.
   * false или undefined — показывать «…».
   */
  ready?: boolean
}

/**
 * Трек в библиотеке.
 */
export interface LibraryTrack extends Track {
  /** В какой папке лежит */
  folderId: string
  /** Хэндл файла — опционально, у треков из Диска его нет */
  handle?: FileSystemFileHandle
  /**
   * Полный путь на Яндекс.Диске: 'disk:/все,что наше/...'.
   * Заполняется только для треков из Диска.
   */
  remotePath?: string
  /**
   * Происхождение трека: в облаке / скачан / только локально.
   * Опционально: если не задано — считается 'remote'.
   */
  origin?: TrackOrigin
}

/**
 * Промежуточный результат обхода папки.
 */
export interface CollectedLibrary {
  folders: Folder[]
  tracks: LibraryTrack[]
  rootFolderId: string
  rootFolderName: string
}
