// src/types/plugin.ts

import type { FolderId, TrackSourceId } from './ids';
import type { LocalTrackSource, CloudTrackSource, StreamingTrackSource } from './track';

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
}

export interface PluginFolderPayload {
  id: FolderId;
  parentId: FolderId | null;
  name: string;
  urlPath: string;
}

export interface PluginSnapshot {
  folders: PluginFolderPayload[];
  tracks: PluginTrackPayload[];
  removedSourceIds?: TrackSourceId[];
  removedFolderIds?: FolderId[];
}
