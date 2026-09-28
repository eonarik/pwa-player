// src/plugins/types.ts

import type { CollectedLibrary, Folder, LibraryTrack } from '@/types/library'

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

  readonly canDownload: boolean

  download?(
    context: PluginContext,
    tracks: LibraryTrack[],
    options: DownloadOptions,
  ): Promise<DownloadResult>

  disconnect(context: PluginContext): Promise<void>
}

// --- Опции загрузки --------------------------------------------------

export interface LoadOptions {
  forceRefresh?: boolean
}

// --- Скачивание ------------------------------------------------------

export interface DownloadOptions {
  targetDir: FileSystemDirectoryHandle
  subPath: string
  onProgress?: (done: number, total: number, currentName: string) => void
  signal?: AbortSignal
  onConflict?: ConflictPolicy
  resolveConflict?: (name: string) => Promise<ConflictResolution>
}

export type ConflictPolicy = 'ask' | 'skip' | 'overwrite' | 'rename'
export type ConflictResolution = 'skip' | 'overwrite' | 'rename' | 'rename-all'

export interface DownloadResult {
  downloaded: number
  skipped: number
  failed: Array<{ track: LibraryTrack; error: string }>
  aborted: boolean
}

// --- Контекст плагина ------------------------------------------------

export interface PluginContext {
  readonly writer: LibraryWriter

  showModal<T>(options: ModalOptions): Promise<T>

  showToast(message: string, type?: 'info' | 'success' | 'error'): void

  readonly storage: PluginStorage

  fetchCover(artist: string, title: string): Promise<string | null>

  readonly proxyUrl: string
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

export type { LibraryTrack, Folder, CollectedLibrary }
