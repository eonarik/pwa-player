// src/plugins/radio/manifest.ts
import type { PluginManifest } from '../types'
import { PLUGIN_ID, PLUGIN_NAME, PLUGIN_ICON } from './constants'
import { getSavedStations } from './index'

export const manifest: PluginManifest = {
  id: PLUGIN_ID,
  name: PLUGIN_NAME,
  icon: PLUGIN_ICON,
  version: '0.1.0',
  enabled: true,
  canDownload: false,
  isLiveStream: true,
  isStateless: true,
  customRoute: 'radio',
  order: 10,
  entry: () => import('./index'),
  extension: () => import('./extension'),
  hasCustomData: () => getSavedStations().length > 0,
  clearData: () => {
    localStorage.removeItem('radio:saved-stations')

    localStorage.removeItem('radio:topLimit')
    localStorage.removeItem('radio:topOrder')
    localStorage.removeItem('radio:topCountry')
    localStorage.removeItem('radio:topTags')
    localStorage.removeItem('radio:topHidden')
    localStorage.removeItem('radio:searchQuery')

    localStorage.removeItem('radio:cache:countries')
    localStorage.removeItem('radio:cache:top')
    localStorage.removeItem('radio:cache:search')
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('radio:cache:tags')) localStorage.removeItem(key)
    }
  },

  getSettings: () => ({
    sections: [
      {
        id: 'radio-cache',
        title: 'Кеш',
        description:
          'Страны, теги и последние результаты поиска сохраняются локально, чтобы радио работало при недоступности сервера.',
        fields: [
          {
            type: 'action',
            id: 'clear-cache',
            label: 'Очистить кеш радио',
            description: 'Удалить сохранённые страны, теги и результаты поиска. Станции останутся.',
          },
        ],
      },
    ],
  }),

  runSettingsAction: async (actionId: string) => {
    if (actionId === 'clear-cache') {
      const { radioBrowserClient } = await import('./RadioBrowserClient')
      const { radioService } = await import('./RadioService')
      const { toastService } = await import('@/services/ui/ToastService')
      radioBrowserClient.clearCache()
      radioService.clearCache()
      toastService.success('Кеш радио очищен')
    }
  },
}
