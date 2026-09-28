// src/plugins/local/manifest.ts

import type { PluginManifest } from '../types'

export const manifest: PluginManifest = {
  id: 'local',
  name: 'Локальная папка',
  icon: '📁',
  version: '0.1.0',
  enabled: true,
  entry: () => import('./index'),
}
