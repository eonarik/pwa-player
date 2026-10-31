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
  /** Обновить прогресс (n/total) и показать его на кнопке. */
  setProgress: (progress: CollectionActionProgress | null) => void;
}

/**
 * Действие над коллекцией треков (плейлист, история, дизлайки, папка, альбом).
 *
 * Используется для того, чтобы плагин мог добавить кнопку в шапку списка
 * (например, «Найти в Звуке» для недоступных треков). Ядро рендерит кнопку
 * и вызывает `run`, ничего не зная о специфике.
 */
export interface PluginCollectionAction {
  id: string;
  label: string;
  icon?: IconName;
  /** Текст всплывающей подсказки. Если пусто — берётся `label`. */
  tooltip?: string;
  /**
   * Показывать ли действие. Вызывается с треками текущего представления
   * (уже отфильтрованными по поиску и фильтру источника).
   */
  shouldShow: (tracks: Track[]) => boolean | Promise<boolean>;
  /**
   * Выполнить действие. Плагин сам отвечает за ошибки, но прогресс
   * должен репортить через `ctx.setProgress`, чтобы ядро отрисовало
   * его на кнопке (а не плодило тосты).
   */
  run: (tracks: Track[], ctx: CollectionActionContext) => void | Promise<void>;
}

export interface PluginExtension {
  menuItems?: PluginMenuItem[];
  routes?: RouteRecordRaw[];
  getSettings?: () => PluginSettingsSchema | Promise<PluginSettingsSchema>;
  /** Действия над коллекциями, рендерятся в шапке `TrackListPage`. */
  collectionActions?: PluginCollectionAction[];
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
}

export interface LoadOptions {
  forceRefresh?: boolean;
}

export interface ScanFolderOptions {
  recursive: boolean;
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

export interface LibrarySource {
  readonly id: string;
  readonly name: string;
  readonly icon: string;

  isAvailable(): boolean;
  isDisconnected?(): boolean;

  connect(context: PluginContext): Promise<void>;
  load(context: PluginContext, options?: LoadOptions): Promise<PluginSnapshot>;
  restoreFromCache(context: PluginContext): Promise<PluginSnapshot | null>;

  scanFolder?(context: PluginContext, folderId: FolderId, options: ScanFolderOptions): Promise<PluginSnapshot>;

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

  getTextFiles?(context: PluginContext, folderId: FolderId): Promise<TextFileRef[]>;
  writeTextFile?(context: PluginContext, remotePath: string, content: string): Promise<{ modified: string | null }>;
  readTextFile?(
    context: PluginContext,
    remotePath: string,
  ): Promise<{ content: string; modified: string | null } | null>;

  fetchMetadata?(artist: string, title: string): Promise<FetchedMetadata | null>;

  applyCandidate?(trackId: TrackId, extMetadata: Record<string, unknown>): void | Promise<void>;
}

export interface PluginContext {
  writer: LibraryWriter;
  showModal<T>(options: ModalOptions): Promise<T>;
  showToast(message: string, type?: 'info' | 'success' | 'error'): void;
  readonly storage: PluginStorage;
  readonly proxyUrl: string;
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
