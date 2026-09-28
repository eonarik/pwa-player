// src/plugins/registry.ts

import type { LibrarySource, PluginManifest } from './types'

// --- Автоматический поиск манифестов ---------------------------------

/**
 * Vite на этапе сборки находит все manifest.ts в подпапках plugins/
 * и создаёт карту ленивых импортов.
 *
 * eager: true — манифесты загружаются синхронно (это маленькие объекты).
 * Код плагинов (entry) загружается лениво, при вызове loadPlugin().
 */
const manifestModules = import.meta.glob<{ manifest: PluginManifest }>('./*/manifest.ts', {
  eager: true,
})

// --- Реестр ----------------------------------------------------------

interface RegisteredPlugin {
  manifest: PluginManifest
  /** Кэш загруженного модуля — чтобы не грузить повторно */
  loaded: LibrarySource | null
}

const registry = new Map<string, RegisteredPlugin>()

// Заполняем реестр при импорте модуля
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

// --- Публичный API ---------------------------------------------------

/**
 * Список зарегистрированных плагинов (манифесты).
 * Порядок — как их вернул import.meta.glob (по алфавиту пути).
 */
export function getPlugins(): PluginManifest[] {
  return Array.from(registry.values()).map((p) => p.manifest)
}

/**
 * Есть ли плагин с таким id.
 */
export function hasPlugin(id: string): boolean {
  return registry.has(id)
}

/**
 * Загрузить плагин по id. Возвращает LibrarySource.
 * Кэширует результат — повторный вызов не грузит модуль заново.
 */
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
  return mod.default
}

/**
 * Сбросить кэш загруженного плагина.
 * Полезно при disconnect — чтобы при повторном подключении
 * плагин инициализировался заново.
 */
export function resetPlugin(id: string): void {
  const entry = registry.get(id)
  if (entry) {
    entry.loaded = null
  }
}

// --- Дебаг -----------------------------------------------------------

if (import.meta.env.DEV) {
  const ids = getPlugins().map((p) => `${p.icon} ${p.id}`)
  console.info(`[plugins] зарегистрировано: ${ids.length ? ids.join(', ') : 'нет'}`)
}
