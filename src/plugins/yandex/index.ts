// src/plugins/yandex/index.ts

import type { LibrarySource, PluginContext, LoadOptions } from '../types'

/**
 * Заглушка плагина Яндекс.Диска.
 * Реальная реализация переедет сюда из services/yandex/ и stores/library.ts.
 */
const yandexPlugin: LibrarySource = {
  id: 'yandex',
  name: 'Яндекс.Диск',
  icon: '☁️',

  isAvailable(): boolean {
    return typeof window !== 'undefined'
  },

  async connect(_context: PluginContext): Promise<void> {
    throw new Error('[yandex] not implemented yet')
  },

  async load(_context: PluginContext, _options?: LoadOptions): Promise<void> {
    throw new Error('[yandex] not implemented yet')
  },

  async restoreFromCache(_context: PluginContext): Promise<boolean> {
    return false
  },

  buildStreamUrl(): string {
    throw new Error('[yandex] not implemented yet')
  },

  canDownload: true,

  async download(): Promise<never> {
    throw new Error('[yandex] not implemented yet')
  },

  async disconnect(_context: PluginContext): Promise<void> {
    // no-op
  },
}

export default yandexPlugin
