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

// Переопределяем downloadTrack, чтобы использовать fetchWithAuth (с авто-рефрешем)
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

basePlugin.handleStreamError = async (
  _context: PluginContext,
  track: LibraryTrack,
  error: { src: string; message: string },
): Promise<boolean> => {
  if (!error.src.includes('/api/yandex-self/download')) return false

  // TODO: Автоматическое обновление токена при 401 от <audio>.
  // <audio> не отдаёт HTTP-статус, поэтому мы не можем отличить 401 от 500.
  // Временно: не рефрешим токен здесь, просто показываем ошибку.
  // При ACCESS_TTL = 30 дней сессия живёт долго.
  // Когда починим (нужен HEAD-запрос или MediaSource), вернуть refresh.

  const { toastService } = await import('@/services/ui/ToastService')
  toastService.error('Не удалось воспроизвести трек (сессия истекла или файл недоступен)')

  return true
}

export default basePlugin
