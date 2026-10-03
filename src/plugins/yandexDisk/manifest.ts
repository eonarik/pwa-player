// src/plugins/yandexDisk/manifest.ts

import type { PluginManifest } from '../types'
import { PLUGIN_ID } from './constants'

export const manifest: PluginManifest = {
  id: PLUGIN_ID,
  name: 'Яндекс.Диск',
  icon: '☁️',
  version: '0.1.0',
  enabled: true,
  canDownload: true,
  entry: () => import('./index'),
}
