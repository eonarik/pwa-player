// src/plugins/zvuk/index.ts
import type { LibrarySource, PluginContext } from '../types'
import type { LibraryTrack } from '@/types/library'

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

  buildStreamUrl(track: LibraryTrack): string {
    const source = track.sources?.[0]
    if (source?.url) return source.url
    return ''
  },

  async disconnect(_context: PluginContext): Promise<void> {
    // Stateless
  },
}

export default zvukPlugin
