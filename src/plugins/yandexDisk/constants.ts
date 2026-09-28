// src/plugins/yandexDisk/constants.ts

/**
 * id плагина. Используется в:
 * - PluginManifest.id
 * - Folder.source
 * - LibraryTrack.pluginId
 * - PersistedYandexTrack.pluginId
 *
 * Менять нельзя без миграции (SCHEMA_VERSION + перезапись данных).
 */
export const PLUGIN_ID = 'yandex'
