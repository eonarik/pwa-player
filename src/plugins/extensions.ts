// src/plugins/extensions.ts

import { getPlugins, isPluginActivated } from './registry';
import type { PluginMenuItem, PluginManifest, PluginCollectionAction } from './types';
import type { RouteRecordRaw } from 'vue-router';
import type { PluginSettingsSchema } from './settingsTypes';
import { loadRemotePlugins } from './remoteLoader';

interface LoadedExtension {
  pluginId: string;
  menuItems: PluginMenuItem[];
  routes: RouteRecordRaw[];
  getSettings: (() => PluginSettingsSchema | Promise<PluginSettingsSchema>) | null;
  runSettingsAction: ((id: string, payload?: unknown) => void | Promise<void>) | null;
  collectionActions: PluginCollectionAction[];
}

let extensions: LoadedExtension[] = [];

export async function loadExtensions(): Promise<void> {
  extensions = [];

  const localPlugins = getPlugins();
  const remotePlugins = await loadRemotePlugins();
  const allPlugins = [...localPlugins, ...remotePlugins];

  for (const manifest of allPlugins) {
    let ext: {
      menuItems?: PluginMenuItem[];
      routes?: RouteRecordRaw[];
      getSettings?: () => PluginSettingsSchema | Promise<PluginSettingsSchema>;
      collectionActions?: PluginCollectionAction[];
    } | null = null;

    if (manifest.extension) {
      try {
        const mod = await manifest.extension();
        ext = mod.default;
      } catch (err) {
        console.error(`[extensions] Failed to load extension for ${manifest.id}`, err);
      }
    }

    // Приоритет: extension.getSettings -> manifest.getSettings
    const getter = ext?.getSettings ?? manifest.getSettings;

    // Если есть расширение или геттер настроек — сохраняем
    if (ext || getter) {
      extensions.push({
        pluginId: manifest.id,
        menuItems: ext?.menuItems ?? [],
        routes: ext?.routes ?? [],
        getSettings: getter ?? null,
        runSettingsAction: manifest.runSettingsAction ?? null,
        collectionActions: ext?.collectionActions ?? [],
      });
    }
  }
}

/** Все динамические пункты меню */
export function getExtensionMenuItems(): PluginMenuItem[] {
  return extensions.flatMap((e) => e.menuItems);
}

/** Все роуты для добавления в Vue Router */
export function getExtensionRoutes(): RouteRecordRaw[] {
  return extensions.flatMap((e) => e.routes);
}

/** Все действия над коллекциями (кнопки в шапке списков) */
export function getCollectionActions(): PluginCollectionAction[] {
  return extensions.flatMap((e) => e.collectionActions);
}

/**
 * Все схемы настроек от плагинов.
 *
 * ВАЖНО: перезапрашивает `getSettings()` каждый раз, чтобы подтянуть
 * актуальные данные (например, список добавленных локальных папок).
 */
export interface PluginSettingsEntry {
  manifest: PluginManifest;
  schema: PluginSettingsSchema;
  runAction: ((id: string, payload?: unknown) => void | Promise<void>) | null;
}

export async function getAllSettingsSchemas(): Promise<PluginSettingsEntry[]> {
  const result: PluginSettingsEntry[] = [];

  for (const manifest of getPlugins()) {
    if (manifest.requiresActivation && !isPluginActivated(manifest.id)) {
      continue;
    }

    const ext = extensions.find((e) => e.pluginId === manifest.id);
    if (!ext?.getSettings) continue;

    try {
      const schema = await ext.getSettings();
      result.push({
        manifest,
        schema,
        runAction: ext.runSettingsAction,
      });
    } catch (err) {
      console.error(`[extensions] failed to load settings for ${manifest.id}`, err);
    }
  }

  return result;
}

/** Очистка (для тестов) */
export function clearExtensions(): void {
  extensions = [];
}
