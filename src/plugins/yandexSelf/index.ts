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

  const { toastService } = await import('@/services/ui/ToastService')
  const { usePlayerStore } = await import('@/stores/player')

  const ok = await yandexSelfService.refresh()

  if (ok) {
    const player = usePlayerStore()
    if (player.currentTrack?.id === track.id) {
      const newUrl = yandexSelfService.buildDownloadUrl(track.remotePath || '')
      player.queue[player.currentIndex] = { ...track, source: newUrl }
      void player.playAt(player.currentIndex)
    }
    return true
  }

  // refresh не удался. Различаем: сеть vs истёкшая сессия.
  if (yandexSelfService.hasRefreshToken()) {
    // Refresh-токен есть, но /refresh упал — скорее всего сеть.
    toastService.error('Не удалось обновить сессию. Проверьте соединение.')
    return true
  }

  // Refresh-токена нет (или сервер отклонил) — нужен повторный вход.
  toastService.showPersistent('Сессия истекла. Требуется повторный вход.', 'info', {
    label: 'Войти',
    onAction: () => {
      yandexSelfService.logout()
      window.location.href = '/'
    },
  })

  return true
}

export default basePlugin
