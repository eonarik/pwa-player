// src/plugins/zvuk/manifest.ts

import type { PluginManifest } from '../types'
import zvukIcon from '@/assets/sber-zvuk.png'

export const manifest: PluginManifest = {
  id: 'zvuk',
  name: 'СберЗвук',
  icon: zvukIcon,
  version: '0.1.0',
  enabled: true,
  canDownload: false,
  isStateless: true,
  isStreaming: true,
  customRoute: 'zvuk',
  order: 40,
  sourcePriority: 30,
  entry: () => import('./index'),
  extension: () => import('./extension'),
}
