// src/plugins/types.ts

import type { Component } from 'vue'
import type { RouteRecordRaw } from 'vue-router'
import type { PluginSettingsSchema } from './settingsTypes'
import type { CollectedLibrary, FileLocation, Folder, LibraryTrack } from '@/types/library'
import type { Track } from '@/types/track'
import type { IconName } from '@/components/icons'

export interface PluginMenuItem {
  id: string
  label: string
  icon: IconName
  routeName: string
}

export interface PluginExtension {
  menuItems?: PluginMenuItem[]
  routes?: RouteRecordRaw[]
  getSettings?: () => PluginSettingsSchema | Promise<PluginSettingsSchema>
}

export interface PluginManifestOptions {
  emptyStateMessage?: string
}

export interface PluginManifest {
  readonly id: string
  readonly name: string
  readonly icon: string
  readonly version: string
  readonly enabled: boolean
  readonly canDownload: boolean
  readonly entry: () => Promise<{ default: LibrarySource }>

  readonly isLiveStream?: boolean
  readonly contentKind?: 'music' | 'linear'
  readonly isStateless?: boolean
  readonly clearData?: () => void | Promise<void>
  readonly customRoute?: string
  readonly hasCustomData?: () => boolean | Promise<boolean>
  readonly extension?: () => Promise<{ default: PluginExtension }>
  readonly getSettings?: () => PluginSettingsSchema | Promise<PluginSettingsSchema>
  readonly runSettingsAction?: (actionId: string, payload?: unknown) => void | Promise<void>
  readonly options?: PluginManifestOptions
  readonly requiresActivation?: boolean
}

export interface ScanFolderOptions {
  recursive: boolean
  removeMissing?: boolean
}

export interface LibrarySource {
  readonly id: string
  readonly name: string
  readonly icon: string
  isAvailable(): boolean
  isDisconnected?(): boolean
  connect(context: PluginContext): Promise<void>
  load(context: PluginContext, options?: LoadOptions): Promise<void>
  restoreFromCache(context: PluginContext): Promise<boolean>

  /**
   * Восстанавливает библиотеку из локальных скачанных файлов (без облака).
   * Заменяет всё содержимое source — не мержит с текущей библиотекой.
   */
  restoreFromLocalFiles?(context: PluginContext): Promise<boolean>

  /**
   * Дополняет текущую библиотеку локальными скачанными файлами:
   * - для уже известных треков обновляет `handle` и `fileLocation: 'both'`;
   * - для новых файлов создаёт `LibraryTrack` с `fileLocation: 'local-only'`;
   * - для новых папок добавляет `Folder` и связывает с родителем.
   * Не удаляет ничего из текущей библиотеки.
   */
  mergeLocalIntoLibrary?(context: PluginContext): Promise<void>

  refreshFolder?(context: PluginContext, folderId: string): Promise<void>
  scanFolder?(
    context: PluginContext,
    folderId: string,
    options: ScanFolderOptions,
  ): Promise<boolean>
  buildStreamUrl(track: LibraryTrack): string
  readonly canDownload: boolean
  buildDownloadUrl?(track: LibraryTrack): string
  downloadTrack?(
    context: PluginContext,
    track: LibraryTrack,
    options: DownloadTrackOptions,
  ): Promise<DownloadedTrackInfo>
  removeDownloaded?(
    context: PluginContext,
    track: LibraryTrack,
    targetDir: FileSystemDirectoryHandle,
  ): Promise<void>
  scanDownloadDir?(
    context: PluginContext,
    targetDir: FileSystemDirectoryHandle,
  ): Promise<ScanResult>
  createLocalTrack?(
    context: PluginContext,
    relativePath: string,
    filename: string,
  ): Promise<LibraryTrack | null>
  saveCache?(context: PluginContext): Promise<void>
  disconnect(context: PluginContext): Promise<void>

  handleStreamError?(
    context: PluginContext,
    track: LibraryTrack,
    error: { src: string; message: string },
  ): Promise<boolean>
}

export interface LoadOptions {
  forceRefresh?: boolean
}

export interface DownloadTrackOptions {
  targetDir: FileSystemDirectoryHandle
  onProgress?: (written: number, total: number) => void
  signal?: AbortSignal
}

export interface DownloadedTrackInfo {
  relativePath: string
  size: number
  /**
   * Хэндл скачанного файла. Позволяет вызвать `orchestrator` → `updateTrackHandle`
   * без повторного `getFileHandle` через `getFileHandleFromPath`.
   * Опционально: старые реализации плагинов могут не возвращать.
   */
  handle?: FileSystemFileHandle
}

export interface ScanResult {
  downloaded: Map<string, string>
  onlyLocal: Array<{ relativePath: string; filename: string }>
  missing: string[]
}

export interface PluginContext {
  readonly writer: LibraryWriter
  showModal<T>(options: ModalOptions): Promise<T>
  showToast(message: string, type?: 'info' | 'success' | 'error'): void
  readonly storage: PluginStorage
  readonly proxyUrl: string
  getDownloadDir(): Promise<FileSystemDirectoryHandle | null>
}

export interface LibraryWriter {
  setLibrary(collected: CollectedLibrary, sourceId: string): void
  updateFolder(folderId: string, patch: Partial<Folder>): void
  addFolders(folders: Folder[], sourceId: string): void
  addTracks(tracks: LibraryTrack[], sourceId: string): void
  removeTracks(trackIds: string[]): void
  removeFolders(folderIds: string[]): void
  removeBySource(sourceId: string): void
  updateTrackFileLocation(trackId: string, location: FileLocation): void
  /**
   * Устанавливает (или сбрасывает) хэндл локального файла.
   * Для `fileLocation: 'local-only' | 'both'` — обязателен.
   * Для `'remote-only'` — должен быть `undefined`.
   */
  updateTrackHandle(trackId: string, handle: FileSystemFileHandle | undefined): void
  updateTrackSource(trackId: string, source: string): void
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

export interface PluginStorage {
  get<T>(key: string): Promise<T | undefined>
  set<T>(key: string, value: T): Promise<void>
  del(key: string): Promise<void>
  clear(): Promise<void>
}

export interface ModalOptions {
  title: string
  message?: string
  type: 'input' | 'confirm' | 'custom'
  inputType?: 'text' | 'password'
  inputPlaceholder?: string
  confirmLabel?: string
  cancelLabel?: string
  component?: Component
  props?: Record<string, unknown>
  disableBackdropClose?: boolean
}

export type { Track, LibraryTrack, Folder, CollectedLibrary }
