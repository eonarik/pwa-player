// src/plugins/yandexSelf/index.ts

import { createYandexPlugin } from '../yandexDisk/createPlugin'
import { yandexSelfService } from './YandexSelfService'
import type { PluginContext } from '../types'
import type { LibraryTrack } from '@/types/library'
import type { DownloadTrackOptions, DownloadedTrackInfo } from '../types'
import { downloadUrlToFile } from '@/services/download/downloadUrlToFile'

const basePlugin = createYandexPlugin({
  id: 'yandex-self',
  name: 'Логии',
  icon: '🐹',
  service: yandexSelfService,
  isSelf: true,
})

// Переопределяем downloadTrack, чтобы использовать fetchWithAuth
// (apiClient.fetch с авто-рефрешем при 401).
basePlugin.downloadTrack = async (
  _context: PluginContext,
  track: LibraryTrack,
  options: DownloadTrackOptions,
): Promise<DownloadedTrackInfo> => {
  const url = yandexSelfService.buildDownloadUrl(track.remotePath || '')
  const relativePath = track.path ?? track.filename

  const result = await downloadUrlToFile(url, {
    targetDir: options.targetDir,
    relativePath,
    onProgress: options.onProgress,
    signal: options.signal,
    fetcher: (u, opts) => yandexSelfService.fetchWithAuth(u, opts),
  })
  return { relativePath, size: result.size, handle: result.handle }
}

export default basePlugin
