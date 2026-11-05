// src/services/metadata/MetadataService/migrations.ts

/**
 * Legacy-ключ v0.16.1 и раньше: toggle «Искать метаданные в СберЗвуке»
 * в настройках плагина Zvuk.
 *
 * В 0.16.2 управление перенесено в uiSettings.metadataProviderOrder
 * (глобальная секция «Источники метаданных»). Ключ удаляется при
 * первой загрузке, значение конвертируется в новый формат.
 *
 * Ядро знает про этот ключ ТОЛЬКО как про исторический факт миграции,
 * а не как про зависимость от плагина Zvuk. После 0.17 — можно удалить
 * функцию целиком.
 */
const LEGACY_METADATA_TOGGLE_KEY = 'zvuk:fetchMetadata';

export type LegacyMetadataToggleResult = 'disabled-all-plugins' | 'enabled' | null;

/**
 * Читает и удаляет legacy-ключ. Идемпотентно.
 *
 * @returns
 *  - `'disabled-all-plugins'` — пользователь отключал Zvuk; в новой модели
 *    это трактуется как «включены только built-in провайдеры»;
 *  - `'enabled'` — пользователь не отключал Zvuk (или не трогал настройку);
 *    в новой модели это трактуется как «дефолтный порядок»;
 *  - `null` — legacy-ключа не было (первый запуск или уже мигрировано).
 */
export function consumeLegacyMetadataToggle(): LegacyMetadataToggleResult {
  try {
    const legacy = localStorage.getItem(LEGACY_METADATA_TOGGLE_KEY);
    if (legacy === null) return null;
    localStorage.removeItem(LEGACY_METADATA_TOGGLE_KEY);
    return legacy === 'false' ? 'disabled-all-plugins' : 'enabled';
  } catch {
    return null;
  }
}
