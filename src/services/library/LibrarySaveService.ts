// src/services/library/LibrarySaveService.ts

import { loadPlugin } from '@/plugins/registry'
import { createPluginContext } from '@/plugins/context'

const DEBOUNCE_MS = 5000

class LibrarySaveService {
  private static instance: LibrarySaveService | null = null

  /** Таймеры по pluginId */
  private timers = new Map<string, ReturnType<typeof setTimeout>>()

  static getInstance(): LibrarySaveService {
    if (!LibrarySaveService.instance) {
      LibrarySaveService.instance = new LibrarySaveService()
    }
    return LibrarySaveService.instance
  }

  /**
   * Запланировать сохранение кэша плагина.
   * Дебаунс — 5 секунд. Повторные вызовы с тем же pluginId
   * перезапускают таймер.
   */
  scheduleSave(pluginId: string): void {
    const existing = this.timers.get(pluginId)
    if (existing) clearTimeout(existing)

    const timer = setTimeout(() => {
      this.timers.delete(pluginId)
      void this.flush(pluginId)
    }, DEBOUNCE_MS)

    this.timers.set(pluginId, timer)
  }

  /**
   * Немедленно сохранить кэш плагина.
   */
  async flush(pluginId: string): Promise<void> {
    const existing = this.timers.get(pluginId)
    if (existing) {
      clearTimeout(existing)
      this.timers.delete(pluginId)
    }

    try {
      const plugin = await loadPlugin(pluginId)
      if (!plugin.saveCache) return

      const context = createPluginContext(pluginId)
      await plugin.saveCache(context)
    } catch (err) {
      console.warn(`[library-save] failed to save for "${pluginId}"`, err)
    }
  }

  /**
   * Сохранить все «грязные» плагины немедленно.
   * Вызывается при beforeunload / visibilitychange.
   */
  async flushAll(): Promise<void> {
    const ids = Array.from(this.timers.keys())
    await Promise.all(ids.map((id) => this.flush(id)))
  }
}

export const librarySaveService = LibrarySaveService.getInstance()
