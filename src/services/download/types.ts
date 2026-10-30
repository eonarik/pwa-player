// src/services/download/types.ts

import type { TrackId } from '@/types/ids';

export interface TrackDownloadState {
  trackId: TrackId;
  written: number;
  total: number;
  abort: AbortController;
}

export class DownloadError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'DownloadError';
  }
}

export interface SyncIssues {
  pluginId: string;
  onlyLocal: Array<{ relativePath: string; filename: string }>;
  missing: TrackId[];
}

export interface SyncReport {
  pluginId: string;
  downloaded: number;
  onlyLocalCount: number;
  missingCount: number;
  issues: SyncIssues | null;
}

export interface SelectedIssues {
  onlyLocal: Array<{ pluginId: string; relativePath: string; filename: string }>;
  missing: Array<{ pluginId: string; trackId: TrackId }>;
}
