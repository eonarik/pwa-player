// src/plugins/podcasts/index.ts

import type { LibrarySource, PluginContext } from '../types'
import { PLUGIN_ID, PLUGIN_NAME, PLUGIN_ICON } from './constants'
import { getSubscriptions } from './PodcastStorage'

const podcastsPlugin: LibrarySource = {
  id: PLUGIN_ID,
  name: PLUGIN_NAME,
  icon: PLUGIN_ICON,
  canDownload: true,
  isAvailable: () => true,

  async connect(_context: PluginContext): Promise<void> {
    // no-op
  },

  async load(_context: PluginContext): Promise<void> {
    // no-op
  },

  async restoreFromCache(_context: PluginContext): Promise<boolean> {
    const subs = await getSubscriptions()
    return subs.length > 0
  },

  buildStreamUrl(track): string {
    return typeof track.source === 'string' ? track.source : ''
  },

  async disconnect(_context: PluginContext): Promise<void> {
    // no-op
  },
}

export default podcastsPlugin
