// src/services/library/id.ts

/**
 * ID папки на основе пути.
 * Путь уникален в пределах корня — значит, id стабилен между сканированиями.
 */
export function folderIdFromPath(path: string): string {
  return `folder:${path}`
}

/**
 * ID трека на основе пути.
 * Стабилен между сканированиями, позволяет мёржить.
 */
export function trackIdFromPath(path: string): string {
  return `track:${path}`
}

/** ID корневой папки. Отдельная константа, чтобы не совпадать с folderIdFromPath('') */
export const ROOT_FOLDER_ID = 'folder:__root__'
