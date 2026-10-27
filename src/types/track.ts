// src/types/track.ts

import type { FileLocation, RawMetadata, MetadataSource } from './library'

/**
 * Базовый интерфейс трека.
 * Содержит все возможные поля, которые могут встречаться в плеере,
 * библиотеке, плейлистах, истории и персистентности.
 */
export interface Track {
  /** Уникальный ID (в формате track:pluginId:path) */
  id: string

  /** id плагина-источника: 'local', 'yandex', 'zvuk', ... */
  pluginId: string

  // --- Метаданные ---
  title: string
  artist: string
  album: string
  year?: number
  trackNumber?: number
  genre?: string
  duration?: number
  codec?: string
  /** URL обложки (http(s) или blob) */
  coverUrl?: string

  /** Источник текущих метаданных (для приоритезации) */
  metaSource?: MetadataSource
  /** true, если в файле есть теги (ID3/FLAC) */
  hasId3Tags?: boolean
  /** Снимок первичных метаданных (при сканировании) */
  raw?: RawMetadata

  // --- Источник воспроизведения ---
  /**
   * URL для стриминга.
   * Для локальных копий — пустая строка.
   */
  source?: string

  /**
   * Хэндл файла для локальных копий.
   * Единственный источник правды для локального файла.
   */
  handle?: FileSystemFileHandle
  /** Хэндл директории (для восстановления обложек) */
  directoryHandle?: FileSystemDirectoryHandle

  // --- Локация ---
  /** Имя файла (например, '01.mp3') */
  filename: string
  /** Путь внутри источника (например, 'Rock/01.mp3') */
  path?: string
  /** Полный путь в облаке (например, 'disk:/Music/01.mp3') */
  remotePath?: string
  /** Где физически находится файл */
  fileLocation?: FileLocation
}
