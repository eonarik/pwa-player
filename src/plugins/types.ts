// src/plugins/types.ts

import type { CollectedLibrary, Folder, LibraryTrack } from '@/types/library'
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

  /**
   * Доступен ли источник в текущем окружении.
   * Например, локальный — только в Chrome/Edge (File System Access API).
   */
  isAvailable(): boolean

  /**
   * Подключение к источнику. Для локального — showDirectoryPicker.
   * Для облачного — OAuth, ввод пароля, и т.д.
   *
   * Может запросить UI через PluginContext (например, показать модалку логина).
   * Должен вернуть управление, когда источник готов к load().
   */
  connect(context: PluginContext): Promise<void>

  /**
   * Полная загрузка библиотеки из источника.
   * Плагин наполняет ядро через LibraryWriter.
   */
  load(context: PluginContext, options?: LoadOptions): Promise<void>

  /**
   * Восстановление из кэша (если есть).
   * Возвращает true, если библиотека восстановлена.
   */
  restoreFromCache(context: PluginContext): Promise<boolean>

  /**
   * Точечное обновление папки (если поддерживается).
   * Для локального — не нужно (папка всегда актуальна).
   * Для облачного — перезапросить содержимое.
   */
  refreshFolder?(context: PluginContext, folderId: string): Promise<void>

  /**
   * URL для стриминга трека.
   * Локальный — blob URL из File.
   * Облачный — URL прокси или прямой ссылки.
   */
  buildStreamUrl(track: LibraryTrack): string

  /**
   * Умеет ли источник скачивать треки на локаль.
   * Локальный — нет (уже локальный).
   * Облачный — да.
   */
  readonly canDownload: boolean

  /**
   * Скачать треки в указанную папку.
   * Опционально — если canDownload = false, метод отсутствует.
   */
  download?(
    context: PluginContext,
    tracks: LibraryTrack[],
    options: DownloadOptions,
  ): Promise<DownloadResult>

  /**
   * Отключение источника: удалить кэш, сбросить авторизацию, забыть handle.
   * Ядро вызывает это при смене источника или явном «отключить».
   */
  disconnect(context: PluginContext): Promise<void>
}

// --- Опции загрузки --------------------------------------------------

export interface LoadOptions {
  /** Игнорировать кэш, загрузить заново */
  forceRefresh?: boolean
}

// --- Скачивание ------------------------------------------------------

export interface DownloadOptions {
  /** Корневая папка, куда качать (handle от showDirectoryPicker) */
  targetDir: FileSystemDirectoryHandle
  /** Относительный путь внутри targetDir (например, 'Мой плейлист/') */
  subPath: string
  /** Прогресс: сколько скачано, сколько всего, что качается сейчас */
  onProgress?: (done: number, total: number, currentName: string) => void
  /** Сигнал отмены */
  signal?: AbortSignal
  /** Что делать при конфликте имён */
  onConflict?: ConflictPolicy
  /** Callback для запроса решения при конфликте (если onConflict = 'ask') */
  resolveConflict?: (name: string) => Promise<ConflictResolution>
}

export type ConflictPolicy = 'ask' | 'skip' | 'overwrite' | 'rename'
export type ConflictResolution = 'skip' | 'overwrite' | 'rename' | 'rename-all'

export interface DownloadResult {
  /** Сколько файлов успешно скачано */
  downloaded: number
  /** Сколько пропущено (конфликты + skip) */
  skipped: number
  /** Ошибки по конкретным трекам */
  failed: Array<{ track: LibraryTrack; error: string }>
  /** Был ли отменён */
  aborted: boolean
}

// --- Контекст плагина ------------------------------------------------

/**
 * Всё, что ядро даёт плагину. Плагин не импортирует ядро напрямую —
 * только получает этот объект.
 */
export interface PluginContext {
  // --- Наполнение ядра ---------------------------------------------

  /** Writer для библиотеки — плагин кладёт сюда folders и tracks */
  readonly writer: LibraryWriter

  // --- UI ----------------------------------------------------------

  /** Показать модалку с произвольным содержимым. Возвращает результат. */
  showModal<T>(options: ModalOptions): Promise<T>

  /** Показать тост (уведомление) */
  showToast(message: string, type?: 'info' | 'success' | 'error'): void

  // --- Хранилище ---------------------------------------------------

  /** IDB-store, изолированный по id плагина */
  readonly storage: PluginStorage

  // --- Общие сервисы -----------------------------------------------

  /** Поиск обложек через прокси (iTunes + Deezer) */
  fetchCover(artist: string, title: string): Promise<string | null>

  /** Базовый URL прокси (если плагину нужно ходить на бэкенд) */
  readonly proxyUrl: string
}

// --- LibraryWriter ---------------------------------------------------

/**
 * API ядра для наполнения библиотеки.
 * Плагин вызывает эти методы, ядро обновляет свои сторы.
 */
export interface LibraryWriter {
  /** Полная замена библиотеки (при load) */
  setLibrary(collected: CollectedLibrary, sourceId: string): void

  /** Точечное обновление папки (при refreshFolder) */
  updateFolder(folderId: string, patch: Partial<Folder>): void

  /** Удалить треки (при refresh, если что-то исчезло) */
  removeTracks(trackIds: string[]): void

  /** Удалить папки (при refresh) */
  removeFolders(folderIds: string[]): void

  /** Текущий id папки, которую обновляем (для refresh) */
  getCurrentFolderId(): string | null

  /** Установить текущую папку (после load) */
  setCurrentFolder(folderId: string): void
}

// --- PluginStorage ---------------------------------------------------

/**
 * Изолированное хранилище плагина.
 * Каждый плагин получает свой namespace в IDB.
 */
export interface PluginStorage {
  get<T>(key: string): Promise<T | undefined>
  set<T>(key: string, value: T): Promise<void>
  del(key: string): Promise<void>
  clear(): Promise<void>
}

// --- Модалки ---------------------------------------------------------

export interface ModalOptions {
  /** Заголовок модалки */
  title: string
  /** Текст (опционально) */
  message?: string
  /** Тип: input / confirm / custom */
  type: 'input' | 'confirm' | 'custom'
  /** Для input: placeholder, type (password/text) */
  inputType?: 'text' | 'password'
  inputPlaceholder?: string
  /** Для confirm: текст кнопок */
  confirmLabel?: string
  cancelLabel?: string
}

// --- Экспорт типа Track для удобства ---------------------------------

export type { Track, LibraryTrack, Folder, CollectedLibrary }
