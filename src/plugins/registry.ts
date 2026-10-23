// src/plugins/registry.ts

import { ref } from 'vue'
import type { LibrarySource, PluginManifest } from './types'

const manifestModules = import.meta.glob<{ manifest: PluginManifest }>('./*/manifest.ts', {
  eager: true,
})

interface RegisteredPlugin {
  manifest: PluginManifest
  loaded: LibrarySource | null
}

const registry = new Map<string, RegisteredPlugin>()

for (const [path, mod] of Object.entries(manifestModules)) {
  const manifest = mod.manifest

  if (!manifest) {
    console.warn(`[plugins] ${path} не экспортирует manifest`)
    continue
  }

  if (!manifest.enabled) {
    console.info(`[plugins] ${manifest.id} отключён (enabled: false)`)
    continue
  }

  if (registry.has(manifest.id)) {
    console.warn(`[plugins] дубликат id "${manifest.id}" (${path}), пропускаю`)
    continue
  }

  registry.set(manifest.id, { manifest, loaded: null })
}

/**
 * Кэш «плагин отключён». Обновляется при `loadPlugin` (первичная загрузка),
 * `connect` / `disconnect` (через `setPluginDisconnected`).
 *
 * Реактивность: `disconnectedVersion` инкрементируется при изменении,
 * чтобы computed, читающие `isPluginDisconnected`, пересчитывались.
 */
const disconnectedCache = new Map<string, boolean>()
const disconnectedVersion = ref(0)

export function getPlugins(): PluginManifest[] {
  return Array.from(registry.values()).map((p) => p.manifest)
}

export function hasPlugin(id: string): boolean {
  return registry.has(id)
}

export async function loadPlugin(id: string): Promise<LibrarySource> {
  const entry = registry.get(id)
  if (!entry) {
    throw new Error(`[plugins] плагин "${id}" не найден`)
  }

  if (entry.loaded) {
    return entry.loaded
  }

  const mod = await entry.manifest.entry()
  entry.loaded = mod.default

  // Первичная загрузка: синхронизируем кэш с реальным состоянием сервиса.
  disconnectedCache.set(id, mod.default.isDisconnected?.() ?? false)
  disconnectedVersion.value++

  return mod.default
}

export function resetPlugin(id: string): void {
  const entry = registry.get(id)
  if (entry) {
    entry.loaded = null
  }
  disconnectedCache.delete(id)
  disconnectedVersion.value++
}

/**
 * Синхронно возвращает текущее известное состояние «плагин отключён».
 *
 * Реактивен: чтение `disconnectedVersion.value` подписывает вызывающий
 * computed на изменения.
 *
 * Если плагин ещё не загружен — `false` (по умолчанию «не отключён»).
 * Если у плагина нет `isDisconnected` (например, `local`) — тоже `false`.
 */
export function isPluginDisconnected(pluginId: string): boolean {
  void disconnectedVersion.value
  return disconnectedCache.get(pluginId) ?? false
}

/**
 * Обновить кэш после `connect` / `disconnect`. Вызывается верхним уровнем
 * (`HomeView`), когда известно, что состояние плагина изменилось.
 *
 * Идемпотентно: повторный вызов с тем же значением не инкрементирует версию
 * (не дёргает лишний раз computed-подписчиков).
 */
export function setPluginDisconnected(pluginId: string, value: boolean): void {
  const prev = disconnectedCache.get(pluginId)
  if (prev === value) return
  disconnectedCache.set(pluginId, value)
  disconnectedVersion.value++
}

export function pluginCanDownload(source: string): boolean {
  const manifest = registry.get(pluginIdFromSource(source))?.manifest
  return manifest?.canDownload ?? false
}

/**
 * Возвращает id плагина из source.
 */
export function pluginIdFromSource(source: string): string {
  const colon = source.indexOf(':')
  return colon === -1 ? source : source.slice(0, colon)
}

export function isPluginActivated(id: string): boolean {
  const manifest = registry.get(id)?.manifest
  if (!manifest) return false
  if (!manifest.requiresActivation) return true
  return localStorage.getItem(`plugin-activated:${id}`) === 'true'
}

const ACTIVATION_CODES: Record<string, string> = {
  'yandex-self': 'logii',
}

export function activatePlugin(id: string, code: string): boolean {
  const expected = ACTIVATION_CODES[id]
  if (!expected) return false
  if (code.trim() !== expected) return false

  localStorage.setItem(`plugin-activated:${id}`, 'true')
  return true
}

export function isLiveStream(pluginId: string): boolean {
  const manifest = registry.get(pluginIdFromSource(pluginId))?.manifest
  return manifest?.isLiveStream ?? false
}

export function getContentKind(pluginId: string): 'music' | 'linear' {
  const manifest = registry.get(pluginIdFromSource(pluginId))?.manifest
  return manifest?.contentKind ?? 'music'
}

export function isLinearContent(pluginId: string): boolean {
  return getContentKind(pluginId) === 'linear'
}

if (import.meta.env.DEV) {
  const ids = getPlugins().map((p) => `${p.icon} ${p.id}`)
  console.info(`[plugins] зарегистрировано: ${ids.length ? ids.join(', ') : 'нет'}`)
}
