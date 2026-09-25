// src/types/library.ts

import type { Track } from './track'

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
  /** Хэндл директории — для повторного доступа и поиска обложек */
  handle: FileSystemDirectoryHandle
  /** id подпапок в порядке добавления */
  childFolderIds: string[]
  /** id треков в порядке сортировки (по имени файла) */
  trackIds: string[]
  /** Общее число треков во всём поддереве (для отображения) */
  totalTrackCount: number
}

/**
 * Трек в библиотеке.
 *
 * Расширяет Track — значит, его можно напрямую класть в очередь плеера
 * без конвертации. Разница только в том, что в библиотеке track
 * всегда привязан к папке и всегда имеет handle (обязательный).
 */
export interface LibraryTrack extends Track {
  /** В какой папке лежит */
  folderId: string
  /** Хэндл файла — обязательно, в отличие от Track.handle */
  handle: FileSystemFileHandle
}

/**
 * Промежуточный результат обхода папки.
 * Возвращается из FileSystemService.collectLibrary.
 */
export interface CollectedLibrary {
  folders: Folder[]
  tracks: LibraryTrack[]
  rootFolderId: string
  rootFolderName: string
}
