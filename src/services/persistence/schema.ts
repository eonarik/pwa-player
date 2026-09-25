// src/services/persistence/schema.ts

/**
 * Версия схемы персистентности.
 *
 * Меняй при любом несовместимом изменении:
 * - переименование ключа
 * - изменение структуры PersistedState / PersistedTrack
 * - изменение типа ID (например, ROOT_FOLDER_ID)
 * - переезд на другой store
 *
 * При загрузке приложения: если сохранённая версия != текущей,
 * все данные в IDB удаляются перед первым чтением.
 */
export const SCHEMA_VERSION = 4

export const SCHEMA_VERSION_KEY = 'player:schemaVersion'
