// src/plugins/yandexDisk/types.ts

import type { FolderId } from '@/types/ids';
import type { PluginContext, PluginSnapshot, ScanFolderOptions } from '../types';

export interface YandexResourceItem {
  path: string;
  name: string;
  type: 'dir' | 'file';
  size?: number;
  mime_type?: string;
  media_type?: string;
  created?: string;
  modified?: string;
  isAudio?: boolean;
}

export interface YandexResourcesResponse {
  path: string;
  total: number;
  items: YandexResourceItem[];
  _embedded?: {
    items: YandexResourceItem[];
  };
}

export interface YandexTextResponse {
  content: string;
  modified: string | null;
  size: number | null;
}

export interface YandexWriteResponse {
  ok: boolean;
  modified: string | null;
}

export interface YandexDownloadResponse {
  relativePath: string;
  size: number;
}

export interface IYandexService {
  ping?(): Promise<boolean>;
  login?(): Promise<boolean>;
  logout?(): void;
  isDisconnected?(): boolean;
  setDisconnected?(val: boolean): void;
  isCancelled?(): boolean;
  setCancelled?(val: boolean): void;
  checkSession?(): Promise<'ok' | 'expired' | 'unavailable'>;
  listResources(path: string): Promise<YandexResourcesResponse>;
  buildDownloadUrl(path: string): string;
  readTextFile(remotePath: string): Promise<YandexTextResponse | null>;
  writeTextFile(remotePath: string, content: string): Promise<YandexWriteResponse>;
}

export interface PersistedYandexFolder {
  id: FolderId;
  pluginId: string;
  name: string;
  parentId: FolderId | null;
  remotePath: string;
}

export interface PersistedYandexLibrary {
  folders: PersistedYandexFolder[];
  tracks: import('@/types/track').Track[];
  folderMap: Record<string, string>; // remotePath → folderId
  savedAt: number;
}

export type ScanFolderImpl = (
  context: PluginContext,
  folderId: FolderId,
  options: ScanFolderOptions,
) => Promise<PluginSnapshot>;
