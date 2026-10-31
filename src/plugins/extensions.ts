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
  settingsSchema: PluginSettingsSchema | null;
  runSettingsAction: ((id: string, payload?: unknown) => void | Promise<void>) | null;
  collectionActions: PluginCollectionAction[];
}

let extensions: LoadedExtension[] = [];

async function loadSettingsSchema(
  manifest: PluginManifest,
  extensionGetSettings: (() => PluginSettingsSchema | Promise<PluginSettingsSchema>) | null,
): Promise<PluginSettingsSchema | null> {
  const getter = extensionGetSettings ?? manifest.getSettings;
  if (!getter) return null;

  try {
    return await getter();
  } catch (err) {
    console.error(`[extensions] failed to load settings for ${manifest.id}`, err);
    return null;
  }
}

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

    const settingsSchema = await loadSettingsSchema(manifest, ext?.getSettings ?? null);

    if (!ext && !settingsSchema) continue;

    extensions.push({
      pluginId: manifest.id,
      menuItems: ext?.menuItems ?? [],
      routes: ext?.routes ?? [],
      settingsSchema,
      runSettingsAction: manifest.runSettingsAction ?? null,
      collectionActions: ext?.collectionActions ?? [],
    });
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

/** Все схемы настроек от плагинов */
export function getExtensionSettings(): Array<{
  pluginId: string;
  schema: PluginSettingsSchema;
  runAction: LoadedExtension['runSettingsAction'];
}> {
  return extensions
    .filter((e) => e.settingsSchema !== null)
    .map((e) => ({
      pluginId: e.pluginId,
      schema: e.settingsSchema!,
      runAction: e.runSettingsAction,
    }));
}

export interface PluginSettingsEntry {
  manifest: PluginManifest;
  schema: PluginSettingsSchema;
  runAction: ((id: string, payload?: unknown) => void | Promise<void>) | null;
}

export function getAllSettingsSchemas(): PluginSettingsEntry[] {
  const result: PluginSettingsEntry[] = [];

  for (const manifest of getPlugins()) {
    if (manifest.requiresActivation && !isPluginActivated(manifest.id)) {
      continue;
    }

    const ext = extensions.find((e) => e.pluginId === manifest.id);
    const schema = ext?.settingsSchema ?? null;
    if (!schema) continue;

    result.push({
      manifest,
      schema,
      runAction: ext?.runSettingsAction ?? manifest.runSettingsAction ?? null,
    });
  }

  return result;
}

/** Очистка (для тестов) */
export function clearExtensions(): void {
  extensions = [];
}
