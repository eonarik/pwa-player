// src/services/metadata/MetadataService/constants.ts

/**
 * Встроенные провайдеры метаданных (iTunes, Deezer).
 * Они не являются плагинами, но участвуют в uiSettings.metadataProviderOrder
 * на равных с плагинами (пользователь может их включать/выключать и менять порядок).
 *
 * Ядро знает эти id по определению — это часть ядрового функционала.
 */
export const BUILTIN_METADATA_PROVIDERS = ['itunes', 'deezer'] as const;

export type BuiltinMetadataProviderId = (typeof BUILTIN_METADATA_PROVIDERS)[number];

const BUILTIN_SET: ReadonlySet<string> = new Set(BUILTIN_METADATA_PROVIDERS);

export function isBuiltinMetadataProvider(id: string): id is BuiltinMetadataProviderId {
  return BUILTIN_SET.has(id);
}

/**
 * Приоритеты для вставки в metadataProviderOrder при "включении" провайдера.
 * Built-in получают меньшие значения (идут раньше), плагины — по manifest.metadataPriority.
 *
 * Используется только при toggleMetadataProvider(id, true) для позиционирования
 * в массиве. Пользователь может перетащить вручную — это сохраняется.
 */
export const BUILTIN_METADATA_PRIORITY: Record<BuiltinMetadataProviderId, number> = {
  itunes: 0,
  deezer: 1,
};
