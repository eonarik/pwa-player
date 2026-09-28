// src/plugins/local/index.ts

import type { LibrarySource, PluginContext, LoadOptions } from '../types'

/**
 * Заглушка локального плагина.
 * Реальная реализация переедет сюда из services/filesystem/ и stores/library.ts.
 */
const localPlugin: LibrarySource = {
  id: 'local',
  name: 'Локальная папка',
  icon: '📁',

  isAvailable(): boolean {
    return typeof window !== 'undefined' && 'showDirectoryPicker' in window
  },

  async connect(_context: PluginContext): Promise<void> {
    throw new Error('[local] not implemented yet')
  },

  async load(_context: PluginContext, _options?: LoadOptions): Promise<void> {
    throw new Error('[local] not implemented yet')
  },

  async restoreFromCache(_context: PluginContext): Promise<boolean> {
    return false
  },

  buildStreamUrl(): string {
    throw new Error('[local] not implemented yet')
  },

  canDownload: false,

  async disconnect(_context: PluginContext): Promise<void> {
    // no-op
  },
}

export default localPlugin
