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
  /** Источник папки. Не задан — локальная (для совместимости) */
  source?: 'local' | 'yandex'
  /**
   * Полный путь на Яндекс.Диске: 'disk:/все,что наше/loGii3026/...'.
   * Заполняется только для папок из Диска. Нужен для точечного обновления.
   */
  remotePath?: string
}

/**
 * Трек в библиотеке.
 *
 * Расширяет Track — значит, его можно напрямую класть в очередь плеера
 * без конвертации. Разница только в том, что в библиотеке track
 * всегда привязан к папке, а handle опционален (у треков из Диска его нет).
 */
export interface LibraryTrack extends Track {
  /** В какой папке лежит */
  folderId: string
  /** Хэндл файла — опционально, у треков из Диска его нет */
  handle?: FileSystemFileHandle
  /**
   * Полный путь на Яндекс.Диске: 'disk:/все,что наше/...'.
   * Заполняется только для треков из Диска. Нужен для восстановления source из кэша.
   */
  remotePath?: string
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
