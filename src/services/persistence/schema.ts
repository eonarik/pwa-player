// src/services/persistence/schema.ts

/**
 * Версия схемы персистентности.
 *
 * Меняй при любом несовместимом изменении:
 * - переименование ключа
 * - изменение структуры PersistedState / PersistedTrack
 * - изменение типа ID
 * - переезд на другой store
 *
 * При загрузке приложения: если сохранённая версия != текущей,
 * все данные в IDB удаляются перед первым чтением.
 *
 * История версий:
 * 1-3 — ранние версии (JWT, .settings.json, YANDEX_MUSIC_PATH)
 * 4 — OAuth-сессии, удаление JWT, app:/ как корень Яндекс.Диска
 * 5 — Мультиисточниковые треки (sources[]), отказ от снимков в плейлистах
 */
export const SCHEMA_VERSION = 5

export const SCHEMA_VERSION_KEY = 'player:schemaVersion'
