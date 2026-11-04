// src/services/library/TrackMerger/saveCache.ts

import { loadPlugin, pluginIdFromSource } from '@/plugins/registry';
import { createPluginContext } from '@/plugins/context';

export async function saveCachesForPlugins(pluginIds: string[]): Promise<void> {
  await Promise.all(
    pluginIds.map(async (pid) => {
      if (!pid) return;
      try {
        const pluginId = pluginIdFromSource(pid);
        const plugin = await loadPlugin(pluginId);
        if (plugin.saveCache) {
          const context = createPluginContext(pluginId);
          await plugin.saveCache(context);
        }
      } catch (err) {
        console.warn(`[TrackMerger] failed to save cache for ${pid}`, err);
      }
    }),
  );
}
