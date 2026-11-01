// src/types/plugin.ts

import type { FolderId, TrackId } from './ids';
import type { LocalTrackSource, CloudTrackSource, StreamingTrackSource } from './track';
import type { MetadataSource } from './track';
import type { FolderFile } from './folder';

export type PluginTrackSource =
  Omit<LocalTrackSource, 'id'> | Omit<CloudTrackSource, 'id'> | Omit<StreamingTrackSource, 'id'>;

export interface PluginTrackPayload {
  artist: string;
  title: string;
  album: string;
  coverUrl: string | null;
  duration?: number;
  codec?: string;
  hasId3Tags: boolean;
  provider?: string;
  source: PluginTrackSource;
  metaSource?: MetadataSource;
  hasMetadataEdits?: boolean;
}

export interface PluginFolderPayload {
  id: FolderId;
  parentId: FolderId | null;
  name: string;
  urlPath: string;
  /** Треки, которые лежат в этой папке (заполняется writer'ом при сохранении) */
  trackIds?: TrackId[];
  /** Файлы (не аудио), которые лежат в этой папке */
  files?: FolderFile[];
}

export interface PluginSnapshot {
  folders: PluginFolderPayload[];
  tracks: PluginTrackPayload[];
  removedSourceIds?: import('./ids').TrackSourceId[];
  removedFolderIds?: FolderId[];
}
