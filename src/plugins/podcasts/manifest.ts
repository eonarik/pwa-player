// src/plugins/podcasts/manifest.ts

import type { PluginManifest } from '../types'
import { PLUGIN_ID, PLUGIN_NAME, PLUGIN_ICON } from './constants'
import { getSubscriptions, clearAll } from './PodcastStorage'

export const manifest: PluginManifest = {
  id: PLUGIN_ID,
  name: PLUGIN_NAME,
  icon: PLUGIN_ICON,
  version: '0.1.0',
  enabled: true,
  canDownload: true,
  isStateless: true,
  contentKind: 'linear',
  customRoute: 'podcasts',
  entry: () => import('./index'),
  extension: () => import('./extension'),
  hasCustomData: async () => (await getSubscriptions()).length > 0,
  clearData: async () => {
    await clearAll()
  },
}
