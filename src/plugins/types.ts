// src/plugins/types.ts

import type { Component } from 'vue';
import type { RouteRecordRaw } from 'vue-router';
import type { PluginSettingsSchema } from './settingsTypes';
import type { Track, TrackSource } from '@/types/track';
import type { FolderRef } from '@/types/folder';
import type { PluginSnapshot, PluginFolderPayload, PluginTrackPayload } from '@/types/plugin';
import type { FolderId, TrackId, AlbumId } from '@/types/ids';
import type { LibraryWriter } from '@/services/library/LibraryWriter';
import type { IconName } from '@/components/icons';

export interface PluginMenuItem {
  id: string;
  label: string;
  icon: IconName;
  routeName: string;
}

export interface CollectionActionProgress {
  done: number;
  total: number;
  found?: number;
}

export interface CollectionActionContext {
  setProgress: (progress: CollectionActionProgress | null) => void;
}

export interface PluginCollectionAction {
  id: string;
  label: string;
  icon?: IconName;
  tooltip?: string;
  shouldShow: (tracks: Track[]) => boolean | Promise<boolean>;
  run: (tracks: Track[], ctx: CollectionActionContext) => void | Promise<void>;
}

export interface PluginFolderView {
  /** id плагина, к которому относится view. */
  pluginId: string;
  /** Проверка, подходит ли urlPath под этот view (например, `logii.` в сегментах). */
  match: (urlPath: string) => boolean;
  /** Ленивый импорт компонента. */
  component: () => Promise<{ default: Component }>;
  /** Пропсы компонента, вычисляемые из urlPath. */
  props?: (urlPath: string) => Record<string, unknown>;
}

export interface PluginExtension {
  menuItems?: PluginMenuItem[];
  routes?: RouteRecordRaw[];
  getSettings?: () => PluginSettingsSchema | Promise<PluginSettingsSchema>;
  collectionActions?: PluginCollectionAction[];
  folderViews?: PluginFolderView[];
  /** Кастомные действия в шапке папки. */
  folderActions?: PluginFolderAction[];
}

export interface PluginManifestOptions {
  emptyStateMessage?: string;
}

export interface PluginManifest {
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  readonly version: string;
  readonly enabled: boolean;
  readonly canDownload: boolean;
  readonly entry: () => Promise<{ default: LibrarySource }>;

  readonly order?: number;
  readonly sourcePriority?: number;

  /**
   * Приоритет источника метаданных (обложки, альбомы, теги).
   * Меньше — выше в порядке поиска.
   * Если задан и плагин реализует LibrarySource.fetchMetadata — плагин
   * участвует в автопоиске метаданных (при условии, что он есть в
   * uiSettings.metadataProviderOrder).
   */
  readonly metadataPriority?: number;

  readonly isLiveStream?: boolean;
  readonly isStreaming?: boolean;
  readonly contentKind?: 'music' | 'linear';
  readonly isStateless?: boolean;
  readonly clearData?: () => void | Promise<void>;
  readonly customRoute?: string;
  readonly hasCustomData?: () => boolean | Promise<boolean>;
  readonly extension?: () => Promise<{ default: PluginExtension }>;
  readonly getSettings?: () => PluginSettingsSchema | Promise<PluginSettingsSchema>;
  readonly runSettingsAction?: (actionId: string, payload?: unknown) => void | Promise<void>;
  readonly options?: PluginManifestOptions;
  readonly requiresActivation?: boolean;
  readonly activationCode?: string;

  readonly backup?: {
    localStorageKeys?: string[];
    idbKeys?: string[];
  };
}

export interface LoadOptions {
  forceRefresh?: boolean;
}

export interface ScanFolderOptions {
  recursive: boolean;
  force?: boolean;
  /** Расширения файлов, которые НЕ попадают в files снимка. */
  fileExcludeKinds?: Array<'audio'>;
  /** Колбэк: файл обработан (для итеративного diff). */
  onAfterFileScan?: import('./yandexDisk/scan').ScanProgressCallback['onAfterFileScan'];
  /** Колбэк: все файлы папки обработаны. */
  onAfterFolderScan?: import('./yandexDisk/scan').ScanProgressCallback['onAfterFolderScan'];
}

export interface DownloadTrackOptions {
  targetDir: FileSystemDirectoryHandle;
  onProgress?: (written: number, total: number) => void;
  signal?: AbortSignal;
}

export interface DownloadedTrackInfo {
  relativePath: string;
  size: number;
  handle: FileSystemFileHandle;
}

export interface ScanResult {
  downloaded: Map<TrackId, string>;
  onlyLocal: Array<{ relativePath: string; filename: string }>;
  missing: TrackId[];
}

export interface TextFileRef {
  name: string;
  remotePath: string;
  path: string;
}

export interface FetchedMetadata {
  artist: string;
  title: string;
  album: string;
  coverUrl: string | null;
  source: string;
  similarity: number;
  confident: boolean;
  extMetadata?: Record<string, unknown>;
}

/** Кандидат, найденный поиском плагина (стриминг-каталог). */
export interface SearchCandidate {
  /** id плагина-источника. */
  pluginId: string;
  /** id трека внутри плагина. */
  trackId: string;
  artist: string;
  title: string;
  album?: string;
  durationMs?: number;
  coverUrl?: string | null;
}

export interface LibrarySource {
  readonly id: string;
  readonly name: string;
  readonly icon: string;

  isAvailable(): boolean;
  isDisconnected?(): boolean;

  connect(context: PluginContext): Promise<void>;
  load(context: PluginContext, options?: LoadOptions): Promise<PluginSnapshot>;
  restoreFromCache(context: PluginContext): Promise<PluginSnapshot | null>;

  /**
   * Обработка OAuth-возврата на главную (`/?auth=ok`).
   *
   * Ядро не знает, какой провайдер авторизации за каким плагином стоит:
   * оно опрашивает плагины по очереди, и первый, признавший callback своим
   * (вернувший true), применяет своё состояние подключения. Ключи
   * localStorage и id провайдера остаются внутри плагина.
   *
   * Метод должен быть идемпотентным и дешёвым: опрос идёт для всех плагинов.
   */
  handleAuthCallback?(): Promise<boolean>;

  scanFolder?(context: PluginContext, folderId: FolderId, options: ScanFolderOptions): Promise<PluginSnapshot>;

  canForceScan?(folderId: FolderId): boolean;

  restoreFromLocalFiles?(context: PluginContext): Promise<PluginSnapshot | null>;
  mergeLocalIntoLibrary?(context: PluginContext): Promise<PluginSnapshot | null>;

  buildStreamUrl(source: TrackSource): string;

  readonly canDownload: boolean;
  buildDownloadUrl?(track: Track, source: TrackSource): string;

  downloadTrack?(
    context: PluginContext,
    track: Track,
    source: TrackSource,
    options: DownloadTrackOptions,
  ): Promise<DownloadedTrackInfo>;

  removeDownloaded?(
    context: PluginContext,
    track: Track,
    source: TrackSource,
    targetDir: FileSystemDirectoryHandle,
  ): Promise<void>;

  scanDownloadDir?(context: PluginContext, targetDir: FileSystemDirectoryHandle): Promise<ScanResult>;

  createLocalTrack?(context: PluginContext, relativePath: string, filename: string): Promise<Track | null>;

  saveCache?(context: PluginContext): Promise<void>;

  checkSession?(): Promise<'ok' | 'expired' | 'unavailable'>;
  markDisconnected?(): void;

  disconnect(context: PluginContext): Promise<void>;

  cancelBackgroundScan?(): void;
  isScanning?(): boolean;

  getTextFiles?(context: PluginContext, folderId: FolderId): Promise<TextFileRef[]>;
  writeTextFile?(context: PluginContext, remotePath: string, content: string): Promise<{ modified: string | null }>;
  readTextFile?(
    context: PluginContext,
    remotePath: string,
  ): Promise<{ content: string; modified: string | null } | null>;

  fetchMetadata?(artist: string, title: string): Promise<FetchedMetadata | null>;

  /**
   * Поиск треков в каталоге плагина.
   * Реализуют стриминговые плагины (zvuk и т.п.).
   * Ядро не знает конкретных плагинов — опрашивает всех, кто реализует метод.
   */
  searchTracks?(query: string): Promise<SearchCandidate[]>;

  /**
   * Физический звук кандидата из `searchTracks` (blob для переноса в другие плагины).
   * Возвращает Promise<Blob> или null, если скачивание недоступно.
   */
  fetchAudioBlob?(candidate: SearchCandidate): Promise<Blob | null>;

  applyCandidate?(trackId: TrackId, extMetadata: Record<string, unknown>): void | Promise<void>;

  buildFileUrl?(context: PluginContext, remotePath: string): Promise<string | null>;
}

export interface PluginContext {
  writer: LibraryWriter;
  showModal<T>(options: ModalOptions): Promise<T>;
  showToast(message: string, type?: 'info' | 'success' | 'error'): void;
  readonly storage: PluginStorage;
  getDownloadDir(): Promise<FileSystemDirectoryHandle | null>;
}

export interface PluginStorage {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  del(key: string): Promise<void>;
  clear(): Promise<void>;
}

export interface ModalOptions {
  title: string;
  message?: string;
  type: 'input' | 'confirm' | 'custom';
  inputType?: 'text' | 'password';
  inputPlaceholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  component?: Component;
  props?: Record<string, unknown>;
  disableBackdropClose?: boolean;
}

/**
 * Действие, доступное в шапке папки (FolderHeader).
 * Ядро не знает о конкретных плагинах — рендерит кнопки из
 * `getExtensionFolderActions()`, а плагин решает, показывать ли действие
 * и что делать.
 */
export interface PluginFolderAction {
  id: string;
  label: string;
  icon?: IconName;
  tooltip?: string;
  /** Показывать ли действие для этой папки. */
  shouldShow: (folder: FolderRef) => boolean;
  /** Выполнить действие. Возвращает навигацию (или noop). */
  run: (ctx: FolderActionContext) => Promise<FolderActionResult>;
}

export interface FolderActionContext {
  folder: FolderRef;
  showToast: (message: string, type?: 'info' | 'success' | 'error') => void;
}

export type FolderActionResult = { kind: 'noop' } | { kind: 'navigate'; pluginId: string; urlPath: string };

export type {
  Track,
  TrackSource,
  FolderRef,
  FolderId,
  TrackId,
  AlbumId,
  PluginSnapshot,
  PluginFolderPayload,
  PluginTrackPayload,
};
