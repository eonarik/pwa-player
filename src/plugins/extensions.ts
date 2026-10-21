// src/plugins/extensions.ts

import { getPlugins } from './registry'
import type { PluginMenuItem } from './types'
import type { RouteRecordRaw } from 'vue-router'
import type { PluginSettingsSchema } from './settingsTypes'
import { loadRemotePlugins } from './remoteLoader'

interface LoadedExtension {
  pluginId: string
  menuItems: PluginMenuItem[]
  routes: RouteRecordRaw[]
  settingsSchema: PluginSettingsSchema | null
  runSettingsAction: ((id: string, payload?: unknown) => void | Promise<void>) | null
}

let extensions: LoadedExtension[] = []

export async function loadExtensions(): Promise<void> {
  extensions = []

  const localPlugins = getPlugins()
  const remotePlugins = await loadRemotePlugins()
  const allPlugins = [...localPlugins, ...remotePlugins]

  for (const manifest of allPlugins) {
    if (!manifest.extension) continue

    try {
      const mod = await manifest.extension()
      const ext = mod.default

      let settingsSchema: PluginSettingsSchema | null = null
      if (ext.getSettings) {
        settingsSchema = await ext.getSettings()
      }

      extensions.push({
        pluginId: manifest.id,
        menuItems: ext.menuItems ?? [],
        routes: ext.routes ?? [],
        settingsSchema,
        runSettingsAction: manifest.runSettingsAction ?? null,
      })
    } catch (err) {
      console.error(`[extensions] Failed to load extension for ${manifest.id}`, err)
    }
  }
}

/** Все динамические пункты меню */
export function getExtensionMenuItems(): PluginMenuItem[] {
  return extensions.flatMap((e) => e.menuItems)
}

/** Все роуты для добавления в Vue Router */
export function getExtensionRoutes(): RouteRecordRaw[] {
  return extensions.flatMap((e) => e.routes)
}

/** Все схемы настроек от плагинов */
export function getExtensionSettings(): Array<{
  pluginId: string
  schema: PluginSettingsSchema
  runAction: LoadedExtension['runSettingsAction']
}> {
  return extensions
    .filter((e) => e.settingsSchema !== null)
    .map((e) => ({
      pluginId: e.pluginId,
      schema: e.settingsSchema!,
      runAction: e.runSettingsAction,
    }))
}

/** Очистка (для тестов) */
export function clearExtensions(): void {
  extensions = []
}
