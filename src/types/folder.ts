// src/types/folder.ts

import type { FolderId, TrackId } from './ids';

export type FolderScanState = 'pending' | 'scanning' | 'scanned' | 'error';

export interface FolderScanProgress {
  done: number;
  total: number;
}

export interface FolderFile {
  name: string;
  urlPath: string;
  ext: string;
  url?: string;
  /** ISO-дата изменения файла из источника (для детекции изменений в Логиях). */
  modified?: string | null;
  /** Размер файла в байтах (для детекции изменений). */
  size?: number;
}

export interface FolderRef {
  id: FolderId;
  pluginId: string;
  name: string;
  parentId: FolderId | null;
  urlPath: string;

  trackIds: TrackId[];
  files?: FolderFile[];

  scanState: FolderScanState;
  scanProgress?: FolderScanProgress;
  scanError?: string;
  scanStateUpdatedAt: number;
}
