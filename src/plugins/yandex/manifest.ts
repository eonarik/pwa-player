// src/plugins/yandex/manifest.ts

import type { PluginManifest } from '../types'

export const manifest: PluginManifest = {
  id: 'yandex',
  name: 'Яндекс.Диск',
  icon: '☁️',
  version: '0.1.0',
  enabled: true,
  entry: () => import('./index'),
}
