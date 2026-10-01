// src/services/library/LibrarySaveService.ts

import { loadPlugin } from '@/plugins/registry'
import { createPluginContext } from '@/plugins/context'
import { pluginIdFromSource } from '@/plugins/registry'

/**
 * Дебаунс сохранения кэша плагина.
 * Меньше — чаще сохраняем, но и больше нагрузка.
 * 2 секунды — компромисс, чтобы F5 не терял последние изменения.
 */
const DEBOUNCE_MS = 2000

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
   * Дебаунс — 2 секунды. Повторные вызовы с тем же pluginId
   * перезапускают таймер.
   */
  scheduleSave(pluginId: string): void {
    // source может быть 'local:Music' — нормализуем до 'local'
    const normalized = pluginIdFromSource(pluginId)

    const existing = this.timers.get(normalized)
    if (existing) clearTimeout(existing)

    const timer = setTimeout(() => {
      this.timers.delete(normalized)
      void this.flush(normalized)
    }, DEBOUNCE_MS)

    this.timers.set(normalized, timer)
  }

  /**
   * Немедленно сохранить кэш плагина.
   */
  async flush(pluginId: string): Promise<void> {
    const normalized = pluginIdFromSource(pluginId)

    const existing = this.timers.get(normalized)
    if (existing) {
      clearTimeout(existing)
      this.timers.delete(normalized)
    }

    try {
      const plugin = await loadPlugin(normalized)
      if (!plugin.saveCache) return

      const context = createPluginContext(normalized)
      await plugin.saveCache(context)
    } catch (err) {
      console.warn(`[library-save] failed to save for "${normalized}"`, err)
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
