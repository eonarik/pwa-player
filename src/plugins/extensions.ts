// src/plugins/extensions.ts

import { getPlugins, isPluginActivated } from './registry';
import type {
  PluginMenuItem,
  PluginManifest,
  PluginCollectionAction,
  PluginFolderView,
  PluginFolderAction,
} from './types';
import type { RouteRecordRaw } from 'vue-router';
import type { PluginSettingsSchema } from './settingsTypes';
import { logger } from '@/utils/logger';

interface LoadedExtension {
  pluginId: string;
  menuItems: PluginMenuItem[];
  routes: RouteRecordRaw[];
  getSettings: (() => PluginSettingsSchema | Promise<PluginSettingsSchema>) | null;
  runSettingsAction: ((id: string, payload?: unknown) => void | Promise<void>) | null;
  collectionActions: PluginCollectionAction[];
  folderViews: PluginFolderView[];
  folderActions: PluginFolderAction[];
}

let extensions: LoadedExtension[] = [];

export async function loadExtensions(): Promise<void> {
  extensions = [];

  const localPlugins = getPlugins();

  for (const manifest of localPlugins) {
    let ext: {
      menuItems?: PluginMenuItem[];
      routes?: RouteRecordRaw[];
      getSettings?: () => PluginSettingsSchema | Promise<PluginSettingsSchema>;
      collectionActions?: PluginCollectionAction[];
      folderViews?: PluginFolderView[];
      folderActions?: PluginFolderAction[];
    } | null = null;

    if (manifest.extension) {
      try {
        const mod = await manifest.extension();
        ext = mod.default;
      } catch (err) {
        logger.error(`[extensions] Failed to load extension for ${manifest.id}`, err);
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
        folderActions: ext?.folderActions ?? [],
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

export function getExtensionFolderViews(): PluginFolderView[] {
  return extensions.flatMap((e) => e.folderViews);
}

export function getExtensionFolderActions(): PluginFolderAction[] {
  return extensions.flatMap((e) => e.folderActions);
}

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
      logger.error(`[extensions] failed to load settings for ${manifest.id}`, err);
    }
  }

  return result;
}

export function clearExtensions(): void {
  extensions = [];
}
