// src/types/folder.ts

import type { FolderId, TrackId } from './ids';

/**
 * Файл внутри папки (не аудио).
 * Хранится прямо в FolderRef, чтобы не создавать отдельные сущности в библиотеке.
 */
export interface FolderFile {
  name: string;
  /** Путь от корня плагина (например, 'Music/notes.txt') */
  urlPath: string;
  /** Расширение с точкой (например, '.txt') */
  ext: string;
  /** Прямая ссылка для скачивания/просмотра (опционально) */
  url?: string;
}

export interface FolderRef {
  id: FolderId;
  pluginId: string;
  name: string;
  parentId: FolderId | null;
  urlPath: string;
  /** ID треков, которые лежат в этой папке (для быстрого рендеринга) */
  trackIds: TrackId[];
  /** Файлы (не аудио), которые лежат в этой папке */
  files?: FolderFile[];
}
