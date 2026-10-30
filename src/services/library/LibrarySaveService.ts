// src/services/library/LibrarySaveService.ts

import { loadPlugin } from '@/plugins/registry';
import { createPluginContext } from '@/plugins/context';
import { pluginIdFromSource } from '@/plugins/registry';

const DEBOUNCE_MS = 2000;

class LibrarySaveService {
  private static instance: LibrarySaveService | null = null;

  private timers = new Map<string, ReturnType<typeof setTimeout>>();

  static getInstance(): LibrarySaveService {
    if (!LibrarySaveService.instance) {
      LibrarySaveService.instance = new LibrarySaveService();
    }
    return LibrarySaveService.instance;
  }

  scheduleSave(pluginId: string): void {
    const normalized = pluginIdFromSource(pluginId);

    const existing = this.timers.get(normalized);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.timers.delete(normalized);
      void this.flush(normalized);
    }, DEBOUNCE_MS);

    this.timers.set(normalized, timer);
  }

  async flush(pluginId: string): Promise<void> {
    const normalized = pluginIdFromSource(pluginId);

    const existing = this.timers.get(normalized);
    if (existing) {
      clearTimeout(existing);
      this.timers.delete(normalized);
    }

    try {
      const plugin = await loadPlugin(normalized);
      if (!plugin.saveCache) return;

      const context = createPluginContext(normalized);
      await plugin.saveCache(context);
    } catch (err) {
      console.warn(`[library-save] failed to save for "${normalized}"`, err);
    }
  }

  async flushAll(): Promise<void> {
    const ids = Array.from(this.timers.keys());
    await Promise.all(ids.map((id) => this.flush(id)));
  }
}

export const librarySaveService = LibrarySaveService.getInstance();
