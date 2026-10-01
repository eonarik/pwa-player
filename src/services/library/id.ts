// src/services/library/id.ts

/**
 * ID папки: rootId + путь внутри него.
 * rootId — уникальный идентификатор источника:
 * - 'local' — контейнер локальных папок
 * - 'local:Music' — конкретная локальная папка
 * - 'yandex' — Яндекс.Диск
 */
export function folderIdFromPath(rootId: string, path: string): string {
  return `folder:${rootId}:${path || '__root__'}`
}

/**
 * ID трека: rootId + путь.
 */
export function trackIdFromPath(rootId: string, path: string): string {
  return `track:${rootId}:${path}`
}

/** ID корневой папки. Оставлено для обратной совместимости. */
export const ROOT_FOLDER_ID = 'folder:__root__'
