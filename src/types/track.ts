// src/types/track.ts

import type { FileLocation, RawMetadata, MetadataSource } from './library'

export interface TrackSource {
  /** Уникальный ID источника (например, 'zvuk:123' или 'local:path') */
  id: string
  /** Плагин, к которому относится источник */
  pluginId: string
  /** URL для стриминга (если undefined, значит это локальный файл или handle) */
  url?: string
  /** Приоритет (чем меньше, тем раньше пробуем) */
  priority: number
}

export interface Track {
  /** Уникальный ID трека (основной, по нему трек живет в библиотеке) */
  id: string

  /** id плагина-источника: 'local', 'yandex', 'zvuk', ... */
  pluginId: string

  // --- Метаданные ---
  title: string
  artist: string
  album?: string
  year?: number
  trackNumber?: number
  genre?: string
  duration?: number
  codec?: string

  /**
   * URL обложки. Используется ТОЛЬКО для стриминга без альбомов (радио, подкасты).
   * Для локальных и облачных треков обложка всегда берется из Album.
   */
  coverUrl?: string

  /** Источник текущих метаданных (для приоритезации) */
  metaSource?: MetadataSource
  /** true, если в файле есть теги (ID3/FLAC) */
  hasId3Tags?: boolean
  /** Снимок первичных метаданных (при сканировании). Обложка хранится здесь! */
  raw?: RawMetadata

  // --- Связи с сущностями ---
  /** ID альбома в библиотеке (если есть) */
  albumId?: string
  /**
   * true — трек добавлен из плейлиста/истории/дизлайка (например, стриминг).
   * Такие треки не отображаются в папках и не сохраняются в кеш сканера.
   */
  isVirtual?: boolean

  // --- Источники воспроизведения ---
  /** Массив всех источников (локальные файлы + стримы), отсортированный по priority */
  sources: TrackSource[]

  /**
   * Альтернативные источники (fuzzy-совпадения).
   * Не используются для воспроизведения по умолчанию.
   */
  alternateSources?: TrackSource[]

  // --- Локальные файлы (хэндлы) ---
  /** Хэндл файла для локальных копий (наивысший приоритет) */
  handle?: FileSystemFileHandle
  /** Хэндл директории (для восстановления обложек) */
  directoryHandle?: FileSystemDirectoryHandle

  // --- Локация ---
  /** Имя файла (например, '01.mp3') */
  filename?: string
  /** Путь внутри источника (например, 'Rock/01.mp3') */
  path?: string
  /** Полный путь в облаке (например, 'disk:/Music/01.mp3') */
  remotePath?: string
  /** Где физически находится файл */
  fileLocation?: FileLocation
}
