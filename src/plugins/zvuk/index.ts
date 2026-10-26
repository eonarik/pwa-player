// src/plugins/zvuk/index.ts
import type { LibrarySource, PluginContext } from '../types'

const zvukPlugin: LibrarySource = {
  id: 'zvuk',
  name: 'Звук',
  icon: '🎵',
  canDownload: false,
  isAvailable: () => true,

  async connect(_context: PluginContext): Promise<void> {
    // Stateless
  },

  async load(_context: PluginContext): Promise<void> {
    // Stateless
  },

  async restoreFromCache(_context: PluginContext): Promise<boolean> {
    return false
  },

  buildStreamUrl(track): string {
    return typeof track.source === 'string' ? track.source : ''
  },

  async disconnect(_context: PluginContext): Promise<void> {
    // Stateless
  },
}

export default zvukPlugin
