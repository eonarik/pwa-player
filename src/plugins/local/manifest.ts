// src/plugins/local/manifest.ts

import type { PluginManifest } from '../types'
import { getLocalSettingsSchema, runLocalSettingsAction } from './settings'

export const manifest: PluginManifest = {
  id: 'local',
  name: 'Локальная папка',
  icon: '📁',
  version: '0.1.0',
  enabled: true,
  canDownload: false,
  entry: () => import('./index'),
  getSettings: getLocalSettingsSchema,
  runSettingsAction: runLocalSettingsAction,
}
