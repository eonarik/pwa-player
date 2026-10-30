// src/types/folder.ts

import type { FolderId } from './ids';

export interface FolderRef {
  id: FolderId;
  pluginId: string;
  name: string;
  parentId: FolderId | null;
  urlPath: string;
}
