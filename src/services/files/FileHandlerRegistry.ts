// src/services/files/FileHandlerRegistry.ts

import type { FolderFile } from '@/types/folder';
import type { FolderId } from '@/types/ids';

export interface FileHandlerContext {
  pluginId: string;
  folderId: FolderId;
}

export type FileHandler = (file: FolderFile, ctx: FileHandlerContext) => void;

const handlers = new Map<string, FileHandler>();

export function registerFileHandler(ext: string, handler: FileHandler): void {
  handlers.set(ext.toLowerCase(), handler);
}

export function getFileHandler(ext: string): FileHandler | null {
  return handlers.get(ext.toLowerCase()) || null;
}
