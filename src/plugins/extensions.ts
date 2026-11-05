// src/plugins/extensions.ts

import { getPlugins, isPluginActivated } from './registry';
import type { PluginMenuItem, PluginManifest, PluginCollectionAction, PluginFolderView } from './types';
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
  folderViews: PluginFolderView[];
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
      folderViews?: PluginFolderView[];
    } | null = null;

    if (manifest.extension) {
      try {
        const mod = await manifest.extension();
        ext = mod.default;
      } catch (err) {
        console.error(`[extensions] Failed to load extension for ${manifest.id}`, err);
      }
    }

    const getter = ext?.getSettings ?? manifest.getSettings;

    if (ext || getter) {
      extensions.push({
        pluginId: manifest.id,
        menuItems: ext?.menuItems ?? [],
        routes: ext?.routes ?? [],
        getSettings: getter ?? null,
        runSettingsAction: manifest.runSettingsAction ?? null,
        collectionActions: ext?.collectionActions ?? [],
        folderViews: ext?.folderViews ?? [],
      });
    }
  }
}

export function getExtensionMenuItems(): PluginMenuItem[] {
  return extensions.flatMap((e) => e.menuItems);
}

export function getExtensionRoutes(): RouteRecordRaw[] {
  return extensions.flatMap((e) => e.routes);
}

export function getCollectionActions(): PluginCollectionAction[] {
  return extensions.flatMap((e) => e.collectionActions);
}

/**
 * Все кастомные view для папок.
 */
export function getExtensionFolderViews(): PluginFolderView[] {
  return extensions.flatMap((e) => e.folderViews);
}

/**
 * Найти подходящий view для папки (pluginId + urlPath).
 * Возвращает первый match (порядок регистрации в extension).
 */
export function findFolderView(pluginId: string, urlPath: string): PluginFolderView | null {
  for (const ext of extensions) {
    if (ext.pluginId !== pluginId) continue;
    for (const fv of ext.folderViews) {
      if (fv.match(urlPath)) return fv;
    }
  }
  return null;
}

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

export function clearExtensions(): void {
  extensions = [];
}
