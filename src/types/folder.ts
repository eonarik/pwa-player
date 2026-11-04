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
