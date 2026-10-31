// src/types/folder.ts

import type { FolderId, TrackId } from './ids';

export interface FolderRef {
  id: FolderId;
  pluginId: string;
  name: string;
  parentId: FolderId | null;
  urlPath: string;
  /** ID треков, которые лежат в этой папке (для быстрого рендеринга) */
  trackIds: TrackId[];
}
