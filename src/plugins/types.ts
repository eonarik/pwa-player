// src/plugins/types.ts

import type { CollectedLibrary, Folder, LibraryTrack, TrackOrigin } from '@/types/library'
import type { Track } from '@/types/track'

/**
 * Манифест плагина. Живёт рядом с кодом плагина (manifest.ts).
 * Реестр находит манифесты через import.meta.glob и автоматически
 * регистрирует плагины.
 *
 * Чтобы удалить плагин — удали папку. Чтобы отключить —
 * поставь enabled: false.
 */
export interface PluginManifest {
  /** Уникальный id: 'local', 'yandex', 'dropbox' */
  readonly id: string
  /** Отображаемое имя: 'Локальная папка', 'Яндекс.Диск' */
  readonly name: string
  /** Иконка (эмодзи или имя SVG) */
  readonly icon: string
  /** Версия плагина (для отладки) */
  readonly version: string
  /** Если false — плагин не регистрируется (но остаётся в коде) */
  readonly enabled: boolean
  /**
   * Ленивая загрузка модуля плагина.
   * Возвращает LibrarySource (default export модуля).
   */
  readonly entry: () => Promise<{ default: LibrarySource }>
}

/**
 * Источник библиотеки. Реализуется плагином.
 *
 * Ядро не знает, что внутри: локальная папка, Яндекс.Диск, Dropbox.
 * Оно работает только через этот интерфейс.
 */
export interface LibrarySource {
  readonly id: string
  readonly name: string
  readonly icon: string

  isAvailable(): boolean

  connect(context: PluginContext): Promise<void>

  load(context: PluginContext, options?: LoadOptions): Promise<void>

  restoreFromCache(context: PluginContext): Promise<boolean>

  refreshFolder?(context: PluginContext, folderId: string): Promise<void>

  buildStreamUrl(track: LibraryTrack): string

  // --- Скачивание ---------------------------------------------------

  /**
   * Умеет ли источник скачивать треки на устройство.
   * У локального — false (файлы уже на устройстве).
   */
  readonly canDownload: boolean

  /**
   * URL для скачивания файла (может отличаться от buildStreamUrl —
   * например, download endpoint без Range-запросов).
   * Опционален: если не задан — используется buildStreamUrl.
   */
  buildDownloadUrl?(track: LibraryTrack): string

  /**
   * Скачать один трек.
   * targetDir — папка ЭТОГО источника внутри общего спейса.
   * Плагин сам решает структуру внутри.
   */
  downloadTrack?(
    context: PluginContext,
    track: LibraryTrack,
    options: DownloadTrackOptions,
  ): Promise<DownloadedTrackInfo>

  /**
   * Удалить скачанный файл с устройства.
   * targetDir — папка ЭТОГО источника внутри общего спейса.
   * Для 'downloaded' — удаляет файл, трек остаётся в источнике.
   * Для 'only-local' — удаляет и файл, и трек.
   */
  removeDownloaded?(
    context: PluginContext,
    track: LibraryTrack,
    targetDir: FileSystemDirectoryHandle,
  ): Promise<void>

  /**
   * Сканирует папку скачивания, сопоставляет файлы с библиотекой.
   * Возвращает отчёт.
   */
  scanDownloadDir?(
    context: PluginContext,
    targetDir: FileSystemDirectoryHandle,
  ): Promise<ScanResult>

  saveCache?(context: PluginContext): Promise<void>

  disconnect(context: PluginContext): Promise<void>
}

// --- Опции загрузки --------------------------------------------------

export interface LoadOptions {
  forceRefresh?: boolean
}

// --- Скачивание ------------------------------------------------------

export interface DownloadTrackOptions {
  /** Папка ЭТОГО источника внутри общего спейса */
  targetDir: FileSystemDirectoryHandle
  /** Прогресс: байт записано / всего байт (0 = неизвестно) */
  onProgress?: (written: number, total: number) => void
  /** Сигнал отмены */
  signal?: AbortSignal
}

export interface DownloadedTrackInfo {
  /** Относительный путь внутри targetDir */
  relativePath: string
  /** Размер файла в байтах */
  size: number
}

/**
 * Результат сканирования папки скачивания.
 */
export interface ScanResult {
  /**
   * trackId → относительный путь внутри targetDir.
   * Треки, которые есть и в библиотеке, и в папке.
   */
  downloaded: Map<string, string>

  /**
   * Файлы в папке, которым нет соответствия в библиотеке.
   * Путь — относительный от targetDir.
   */
  onlyLocal: Array<{ relativePath: string; filename: string }>

  /**
   * trackId треков, помеченных как 'downloaded', но файла нет.
   */
  missing: string[]
}

// --- Контекст плагина ------------------------------------------------

export interface PluginContext {
  readonly writer: LibraryWriter

  showModal<T>(options: ModalOptions): Promise<T>

  showToast(message: string, type?: 'info' | 'success' | 'error'): void

  readonly storage: PluginStorage

  fetchCover(artist: string, title: string): Promise<string | null>

  readonly proxyUrl: string

  /**
   * Папка скачивания для этого плагина (если общий спейс выбран).
   * Возвращает null, если спейс не выбран.
   */
  getDownloadDir(): Promise<FileSystemDirectoryHandle | null>
}

// --- LibraryWriter ---------------------------------------------------

/**
 * API ядра для наполнения библиотеки.
 *
 * Ключевое: `setLibrary` НЕ заменяет всю библиотеку — она заменяет
 * только папки и треки указанного sourceId. Чужие плагины не трогаются.
 * Это позволяет нескольким плагинам сосуществовать в одном сторе.
 */
export interface LibraryWriter {
  /**
   * Заменить папки и треки указанного плагина.
   * Папки/треки других плагинов не трогаются.
   */
  setLibrary(collected: CollectedLibrary, sourceId: string): void

  /** Точечно обновить одну папку */
  updateFolder(folderId: string, patch: Partial<Folder>): void

  /** Добавить/обновить папки плагина (не удаляя существующие) */
  addFolders(folders: Folder[], sourceId: string): void

  /** Добавить/обновить треки плагина (не удаляя существующие) */
  addTracks(tracks: LibraryTrack[], sourceId: string): void

  /** Удалить треки по id (с ревоком blob URL) */
  removeTracks(trackIds: string[]): void

  /** Удалить папки по id */
  removeFolders(folderIds: string[]): void

  /** Удалить все папки и треки плагина */
  removeBySource(sourceId: string): void

  /** Обновить origin трека */
  updateTrackOrigin(trackId: string, origin: TrackOrigin): void

  /** Прочитать папку */
  getFolder(folderId: string): Folder | null

  /** Прочитать трек */
  getTrack(trackId: string): LibraryTrack | null

  /** Все папки плагина */
  getFoldersBySource(sourceId: string): Folder[]

  /** Все треки плагина */
  getTracksBySource(sourceId: string): LibraryTrack[]

  /** Текущая открытая папка */
  getCurrentFolderId(): string | null

  /** Установить текущую папку */
  setCurrentFolder(folderId: string): void

  /** Обновить origin трека */
  updateTrackOrigin(trackId: string, origin: TrackOrigin): void

  /** Обновить source трека (например, на File из папки скачивания) */
  updateTrackSource(trackId: string, source: string | File): void

  /** Обновить origin трека */
  updateTrackOrigin(trackId: string, origin: TrackOrigin): void

  /** Обновить source трека (например, на File из папки скачивания) */
  updateTrackSource(trackId: string, source: string | File): void

  /** Обновить duration трека (когда узнали из metadata) */
  updateTrackDuration(trackId: string, duration: number): void
}

// --- PluginStorage ---------------------------------------------------

export interface PluginStorage {
  get<T>(key: string): Promise<T | undefined>
  set<T>(key: string, value: T): Promise<void>
  del(key: string): Promise<void>
  clear(): Promise<void>
}

// --- Модалки ---------------------------------------------------------

export interface ModalOptions {
  title: string
  message?: string
  type: 'input' | 'confirm' | 'custom'
  inputType?: 'text' | 'password'
  inputPlaceholder?: string
  confirmLabel?: string
  cancelLabel?: string
}

// --- Экспорт типа Track для удобства ---------------------------------

export type { Track, LibraryTrack, Folder, CollectedLibrary }
