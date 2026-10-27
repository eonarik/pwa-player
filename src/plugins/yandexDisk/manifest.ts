// src/plugins/yandexDisk/manifest.ts

import diskIcon from '@/assets/yandex-disk.png'
import type { PluginManifest } from '../types'
import { PLUGIN_ID } from './constants'

export const manifest: PluginManifest = {
  id: PLUGIN_ID,
  name: 'Яндекс.Диск',
  icon: diskIcon,
  version: '0.1.0',
  enabled: true,
  canDownload: true,
  order: 30,
  sourcePriority: 20,
  entry: () => import('./index'),
  options: {
    emptyStateMessage:
      'Музыка хранится в папке **«Приложения / CUEI media player»** на вашем Яндекс.Диске.\n' +
      'Добавьте туда треки — и они появятся в плеере.\n\n' +
      'Папка создаётся автоматически при первом подключении.',
  },
}
