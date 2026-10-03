// src/plugins/types.ts

import type { CollectedLibrary, Folder, LibraryTrack, TrackOrigin } from '@/types/library'
import type { Track } from '@/types/track'
import type { PluginSettingsSchema } from './settingsTypes'

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
   * Может ли плагин скачивать треки на устройство.
   * Синхронный флаг — чтобы UI мог решить, показывать ли кнопку,
   * не загружая модуль плагина.
   * Должен совпадать с LibrarySource.canDownload.
   */
  readonly canDownload: boolean
  /**
   * Ленивая загрузка модуля плагина.
   * Возвращает LibrarySource (default export модуля).
   */
  readonly entry: () => Promise<{ default: LibrarySource }>

  /**
   * Схема настроек плагина. SettingsView рендерит её декларативно.
   * Если не задана — плагин не появляется в секции «Плагины».
   */
  readonly getSettings?: () => PluginSettingsSchema | Promise<PluginSettingsSchema>

  /**
   * Выполнить действие из схемы настроек.
   * payload — опциональные данные (например, { name: 'Music' } для пересканирования).
   */
  readonly runSettingsAction?: (actionId: string, payload?: unknown) => void | Promise<void>
}

/**
 * Опции обхода папки.
 */
export interface ScanFolderOptions {
  /** Рекурсивно обходить подпапки? */
  recursive: boolean
  /**
   * Удалять треки, которых больше нет на сервере?
   * - false (по умолчанию) — только добавляем новые.
   * - true — синхронизируем: что на сервере, то и в библиотеке.
   */
  removeMissing?: boolean
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

  /**
   * Обойти папку и, если recursive: true, всё её поддерево.
   *
   * Поведение:
   * - scanStatus === 'scanning' → выходит, возвращает текущий ready.
   * - scanStatus === undefined → обходит саму папку.
   * - scanStatus === 'scanned' и !removeMissing → не обходит саму.
   * - scanStatus === 'scanned' и removeMissing → обходит (для удаления пропавших).
   * - recursive: true → рекурсивно в подпапки.
   *
   * Возвращает true, если всё поддерево готово (ready).
   */
  scanFolder?(
    context: PluginContext,
    folderId: string,
    options: ScanFolderOptions,
  ): Promise<boolean>

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

  /**
   * Создать LibraryTrack из локального файла в папке скачивания.
   * Используется при применении результатов сканирования:
   * файл есть, трека в библиотеке нет → создаём only-local.
   *
   * Плагин сам решает:
   * - как построить trackId
   * - к какой папке привязать (ближайшая существующая)
   * - какие метаданные извлечь
   *
   * Возвращает null, если:
   * - файл недоступен
   * - трек с таким id уже есть в библиотеке
   * - не удалось создать (нет папки, нет метаданных)
   */
  createLocalTrack?(
    context: PluginContext,
    relativePath: string,
    filename: string,
  ): Promise<LibraryTrack | null>

  /**
   * Сохранить текущее состояние библиотеки в IDB плагина.
   * Вызывается ядром после скачивания / удаления / синхронизации,
   * чтобы `origin` и другие изменения пережили перезагрузку.
   */
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
  setLibrary(collected: CollectedLibrary, sourceId: string): void

  updateFolder(folderId: string, patch: Partial<Folder>): void

  addFolders(folders: Folder[], sourceId: string): void

  addTracks(tracks: LibraryTrack[], sourceId: string): void

  removeTracks(trackIds: string[]): void

  removeFolders(folderIds: string[]): void

  removeBySource(sourceId: string): void

  updateTrackOrigin(trackId: string, origin: TrackOrigin): void

  updateTrackSource(trackId: string, source: string | File): void

  updateTrackDuration(trackId: string, duration: number): void

  updateTrackMetadata(
    trackId: string,
    patch: Partial<Pick<LibraryTrack, 'artist' | 'title' | 'album' | 'coverUrl'>>,
  ): void

  getFolder(folderId: string): Folder | null

  getTrack(trackId: string): LibraryTrack | null

  getFoldersBySource(sourceId: string): Folder[]

  getTracksBySource(sourceId: string): LibraryTrack[]

  getCurrentFolderId(): string | null

  setCurrentFolder(folderId: string): void
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
