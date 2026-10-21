// src/plugins/lookup.ts

import { getPlugins, pluginIdFromSource } from './registry'
import type { PluginManifest } from './types'

/**
 * Возвращает манифест плагина по id.
 * `id` может быть как чистым id плагина (`local`, `yandex`),
 * так и source (`local:Music`, `yandex`). Для source извлекается
 * базовый id через `pluginIdFromSource`.
 */
export function getPluginManifest(id: string): PluginManifest | null {
  if (!id) return null
  const baseId = pluginIdFromSource(id)
  return getPlugins().find((p) => p.id === baseId) ?? null
}

/**
 * Возвращает отображаемое имя плагина по id или source.
 * Если плагин не найден — возвращает `fallback` (по умолчанию `<unknown_source>`).
 */
export function getPluginName(id: string, fallback = '<unknown_source>'): string {
  return getPluginManifest(id)?.name ?? fallback
}
