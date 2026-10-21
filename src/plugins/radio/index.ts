// src/plugins/radio/index.ts
import type { LibrarySource, PluginContext } from '../types'
import { PLUGIN_ID, PLUGIN_NAME, PLUGIN_ICON } from './constants'

export interface SavedStation {
  id: string
  name: string
  url: string
  favicon: string
}

const STORAGE_KEY = 'radio:saved-stations'

export function getSavedStations(): SavedStation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function addSavedStation(station: SavedStation) {
  const stations = getSavedStations()
  if (!stations.find((s) => s.id === station.id)) {
    stations.push(station)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stations))
  }
}

const radioPlugin: LibrarySource = {
  id: PLUGIN_ID,
  name: PLUGIN_NAME,
  icon: PLUGIN_ICON,
  canDownload: false,
  isAvailable: () => true,

  async connect(_context: PluginContext): Promise<void> {
    // Мгновенное подключение (ничего не делаем)
  },

  async load(_context: PluginContext): Promise<void> {
    // Радио не наполняет библиотеку, у него свой роут /radio
  },

  async restoreFromCache(_context: PluginContext): Promise<boolean> {
    return true
  },

  buildStreamUrl(track): string {
    return typeof track.source === 'string' ? track.source : ''
  },

  async disconnect(context: PluginContext): Promise<void> {
    context.writer.removeBySource(PLUGIN_ID)
  },
}

export default radioPlugin
