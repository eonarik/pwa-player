// src/services/plugins/connectPlugin.ts

import { loadPlugin, pluginIdFromSource } from '@/plugins/registry';
import { createPluginContext } from '@/plugins/context';

export interface ConnectOptions {
  /** После connect вызвать load(), чтобы подтянуть библиотеку. */
  loadAfter?: boolean;
  /** forceRefresh для load(). */
  forceRefresh?: boolean;
}

/**
 * Вызывает `plugin.connect()` без редиректа и открытия роутов.
 * Используется из HomeView (там потом идёт openPlugin) и из player (при AuthError).
 *
 * Возвращает true, если подключение прошло успешно.
 * Возвращает false, если пользователь отменил (cancelled).
 * Кидает ошибку при других сбоях.
 */
export async function connectPlugin(pluginIdOrSource: string, options: ConnectOptions = {}): Promise<boolean> {
  const pluginId = pluginIdFromSource(pluginIdOrSource);
  const plugin = await loadPlugin(pluginId);
  const context = createPluginContext(pluginId);

  try {
    await plugin.connect(context);
  } catch (err) {
    if (err instanceof Error && err.message === 'cancelled') return false;
    if (err instanceof Error && err.message === 'redirect') return false;
    throw err;
  }

  if (options.loadAfter) {
    try {
      await plugin.load(context, { forceRefresh: options.forceRefresh ?? false });
    } catch (err) {
      console.warn(`[connectPlugin] load after connect failed for "${pluginId}"`, err);
    }
  }

  return true;
}
