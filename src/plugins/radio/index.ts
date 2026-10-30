// src/plugins/radio/index.ts

import type { LibrarySource, PluginContext, PluginSnapshot } from '../types';
import type { TrackSource } from '@/types/track';
import { PLUGIN_ID, PLUGIN_NAME, PLUGIN_ICON } from './constants';

export interface SavedStation {
  id: string;
  name: string;
  url: string;
  favicon: string;
}

const STORAGE_KEY = 'radio:saved-stations';

export function getSavedStations(): SavedStation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s): s is SavedStation =>
        Boolean(s) && typeof s.id === 'string' && typeof s.name === 'string' && typeof s.url === 'string',
    );
  } catch {
    return [];
  }
}

function persistSavedStations(stations: SavedStation[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stations));
    return true;
  } catch (err) {
    console.warn('[radio] failed to persist saved stations', err);
    return false;
  }
}

export function addSavedStation(station: SavedStation): boolean {
  const stations = getSavedStations();
  if (stations.find((s) => s.id === station.id)) return true;
  stations.push(station);
  return persistSavedStations(stations);
}

export function removeSavedStation(stationId: string): boolean {
  const stations = getSavedStations().filter((s) => s.id !== stationId);
  return persistSavedStations(stations);
}

const radioPlugin: LibrarySource = {
  id: PLUGIN_ID,
  name: PLUGIN_NAME,
  icon: PLUGIN_ICON,
  canDownload: false,
  isAvailable: () => true,

  async connect(_context: PluginContext): Promise<void> {
    // Stateless
  },

  async load(_context: PluginContext): Promise<PluginSnapshot> {
    return { folders: [], tracks: [] };
  },

  async restoreFromCache(_context: PluginContext): Promise<PluginSnapshot | null> {
    return { folders: [], tracks: [] };
  },

  buildStreamUrl(source: TrackSource): string {
    if (source.kind !== 'streaming') {
      throw new Error('[radio] buildStreamUrl: source must be streaming');
    }
    return source.url;
  },

  async disconnect(_context: PluginContext): Promise<void> {
    // Stateless
  },
};

export default radioPlugin;
