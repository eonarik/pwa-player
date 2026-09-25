// src/services/metadata/utils.ts

/**
 * Извлекает имя родительской папки из пути.
 * "Radiohead/OK Computer/01 - Airbag.mp3" → "OK Computer"
 * "track01.mp3" → undefined
 */
export function getParentFolderName(path: string): string | undefined {
  const parts = path.split('/').filter(Boolean)
  // Если путь — только имя файла, родителя нет
  if (parts.length < 2) return undefined
  return parts[parts.length - 2]
}

/**
 * Достаёт имя файла из пути.
 */
export function getFileName(path: string): string {
  const parts = path.split('/').filter(Boolean)
  return parts[parts.length - 1] ?? path
}
