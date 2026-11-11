// src/stores/uiSettings/schema.ts

import { BUILTIN_METADATA_PROVIDERS } from '@/services/metadata/MetadataService/constants';
import { consumeLegacyMetadataToggle } from '@/services/metadata/MetadataService/migrations';
import { getPlugins } from '@/plugins/registry';
import { logger } from '@/utils/logger';

export const UI_SETTINGS_KEY = 'player:uiSettings';

export const DEFAULT_METADATA_THRESHOLD = 0.75;
export const DEFAULT_SEARCH_THRESHOLD = 0.75;
export const DEFAULT_PLAYLIST_MATCH_THRESHOLD = 0.75;

export interface PersistedUiSettings {
  showSource: boolean;
  showFiles: boolean;
  metadataThreshold: number;
  searchThreshold: number;
  playlistMatchThreshold: number;
  autoFetchMetadata: boolean;
  autoDownloadTracks: boolean;
  metadataProviderOrder: string[];
  metadataProviderEnabled: Record<string, boolean>;
}

/** Порог сравнения — число из [0, 1]. Всё остальное считаем битым. */
export function isValidThreshold(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

/** Массив строк без дублей. Не-массив или мусор в элементах → null. */
export function sanitizeProviderOrder(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;

  const result: string[] = [];
  const seen = new Set<string>();

  for (const item of raw) {
    if (typeof item !== 'string') continue;
    if (seen.has(item)) continue;
    seen.add(item);
    result.push(item);
  }

  return result;
}

/** Только булевы значения из объекта. Не-объект/массив → null. */
export function sanitizeEnabled(raw: unknown): Record<string, boolean> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  const result: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'boolean') result[key] = value;
  }

  return result;
}

/**
 * Дефолтный порядок ВСЕХ провайдеров (включённых и выключенных):
 * 1. Built-in (itunes, deezer).
 * 2. Плагины с manifest.metadataPriority (по возрастанию).
 */
export function defaultProviderOrder(): string[] {
  const order: string[] = [...BUILTIN_METADATA_PROVIDERS];

  try {
    const pluginProviders = getPlugins()
      .filter((m) => m.metadataPriority !== undefined)
      .sort((a, b) => (a.metadataPriority ?? 0) - (b.metadataPriority ?? 0))
      .map((m) => m.id);

    for (const id of pluginProviders) {
      if (!order.includes(id)) order.push(id);
    }
  } catch {
    // Fallback — только built-in.
  }

  return order;
}

export function defaultValues(): PersistedUiSettings {
  return {
    showSource: false,
    showFiles: false,
    metadataThreshold: DEFAULT_METADATA_THRESHOLD,
    searchThreshold: DEFAULT_SEARCH_THRESHOLD,
    playlistMatchThreshold: DEFAULT_PLAYLIST_MATCH_THRESHOLD,
    autoFetchMetadata: true,
    autoDownloadTracks: false,
    metadataProviderOrder: defaultProviderOrder(),
    metadataProviderEnabled: {},
  };
}

/**
 * Порядок из сохранённых настроек + достраивание недостающих провайдеров.
 *
 * Старый формат хранил в `metadataProviderOrder` только ВКЛЮЧЁННЫЕ провайдеры.
 * Недостающие (built-in и новые плагины) дописываем в конец, чтобы пользователь
 * увидел их и мог включить.
 */
function normalizeProviderOrder(raw: unknown): string[] {
  const sanitized = sanitizeProviderOrder(raw);
  if (sanitized === null) return defaultProviderOrder();

  const seen = new Set(sanitized);
  for (const id of defaultProviderOrder()) {
    if (!seen.has(id)) {
      sanitized.push(id);
      seen.add(id);
    }
  }

  return sanitized;
}

/**
 * Флаг «выключен ли провайдер» при миграции с legacy-ключа Zvuk:
 * отключённый Zvuk в старой модели означал «искать только в built-in»,
 * в новой — все плагины выключены.
 */
function normalizeEnabled(raw: unknown, order: string[], legacyDisabled: boolean): Record<string, boolean> {
  const sanitized = sanitizeEnabled(raw);
  if (sanitized !== null) return sanitized;

  if (!legacyDisabled) return {};

  const disabled: Record<string, boolean> = {};
  for (const id of order) disabled[id] = false;
  return disabled;
}

/**
 * Чтение настроек из localStorage. Битый JSON, недоступный storage или
 * отсутствующий ключ возвращают null — вызывающий использует дефолты.
 *
 * Побочный эффект: одноразовое потребление legacy-ключа `zvuk:fetchMetadata`.
 */
export function readFromStorage(): PersistedUiSettings | null {
  const legacy = consumeLegacyMetadataToggle();
  const legacyDisabled = legacy === 'disabled-all-plugins';

  let raw: string | null = null;
  try {
    raw = localStorage.getItem(UI_SETTINGS_KEY);
  } catch (err) {
    logger.warn('[uiSettings] failed to read from localStorage', err);
    return null;
  }

  if (!raw) {
    const base = defaultValues();
    if (!legacyDisabled) return base;

    const disabled: Record<string, boolean> = {};
    for (const id of base.metadataProviderOrder) disabled[id] = false;
    base.metadataProviderEnabled = disabled;
    return base;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PersistedUiSettings>;
    if (!parsed || typeof parsed !== 'object') return null;

    const metadataProviderOrder = normalizeProviderOrder(parsed.metadataProviderOrder);
    const metadataProviderEnabled = normalizeEnabled(
      parsed.metadataProviderEnabled,
      metadataProviderOrder,
      legacyDisabled,
    );

    return {
      showSource: parsed.showSource ?? false,
      showFiles: parsed.showFiles ?? false,
      metadataThreshold: isValidThreshold(parsed.metadataThreshold)
        ? parsed.metadataThreshold
        : DEFAULT_METADATA_THRESHOLD,
      searchThreshold: isValidThreshold(parsed.searchThreshold) ? parsed.searchThreshold : DEFAULT_SEARCH_THRESHOLD,
      playlistMatchThreshold: isValidThreshold(parsed.playlistMatchThreshold)
        ? parsed.playlistMatchThreshold
        : DEFAULT_PLAYLIST_MATCH_THRESHOLD,
      autoFetchMetadata: parsed.autoFetchMetadata ?? true,
      autoDownloadTracks: parsed.autoDownloadTracks ?? false,
      metadataProviderOrder,
      metadataProviderEnabled,
    };
  } catch (err) {
    logger.warn('[uiSettings] failed to read from localStorage', err);
    return null;
  }
}

export function writeToStorage(data: PersistedUiSettings): void {
  try {
    localStorage.setItem(UI_SETTINGS_KEY, JSON.stringify(data));
  } catch (err) {
    logger.error('[uiSettings] failed to save to localStorage', err);
  }
}
