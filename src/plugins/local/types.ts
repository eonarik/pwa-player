// src/plugins/local/types.ts

import type { Track } from '@/types/track';
import type { FolderRef } from '@/types/folder';

export type PersistedLocalTrack = Track;
export type PersistedLocalFolder = FolderRef;

export interface PersistedLocalLibrary {
  folders: PersistedLocalFolder[];
  tracks: PersistedLocalTrack[];
  folderMap: Record<string, string>;
  rootFolderId: string;
  rootFolderName: string;
  savedAt: number;
}
