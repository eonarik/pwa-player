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
  entry: () => import('./index'),
  extension: () => import('./extension'),
  hasCustomData: () => getSavedStations().length > 0,
  clearData: () => {
    // Удаляем сохраненные станции
    localStorage.removeItem('radio:saved-stations')

    // Удаляем сохраненные фильтры и настройки
    localStorage.removeItem('radio:topLimit')
    localStorage.removeItem('radio:topOrder')
    localStorage.removeItem('radio:topCountry')
    localStorage.removeItem('radio:topTags')
    localStorage.removeItem('radio:topHidden')
  },
}
