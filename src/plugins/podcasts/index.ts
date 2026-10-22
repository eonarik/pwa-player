// src/plugins/podcasts/index.ts

import type { LibrarySource, PluginContext } from '../types'
import { PLUGIN_ID, PLUGIN_NAME, PLUGIN_ICON } from './constants'
import { getSubscriptions } from './PodcastStorage'

/**
 * Плагин подкастов. Stateless: нет папок, нет connect/load.
 * Эпизоды живут в отдельном сторе (`PodcastStorage`), а не в `library`.
 *
 * `buildStreamUrl` используется, если `DownloadOrchestrator` захочет
 * скачать эпизод (см. `Track.source`).
 */
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
    // no-op: эпизоды в PodcastStorage, а не в library
  },

  async restoreFromCache(_context: PluginContext): Promise<boolean> {
    return getSubscriptions().length > 0
  },

  buildStreamUrl(track): string {
    return typeof track.source === 'string' ? track.source : ''
  },

  async disconnect(_context: PluginContext): Promise<void> {
    // no-op
  },
}

export default podcastsPlugin
