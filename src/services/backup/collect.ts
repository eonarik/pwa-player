// src/services/backup/collect.ts

import { get as idbGet } from 'idb-keyval';
import { usePlaylistsStore } from '@/stores/playlists';
import { useHistoryStore } from '@/stores/history';
import { useDislikesStore } from '@/stores/dislikes';
import { useUiSettingsStore } from '@/stores/uiSettings';
import { themeService } from '@/services/ui/ThemeService';
import { getPlugins } from '@/plugins/registry';
import type { PersistedSubscriptions } from '@/plugins/podcasts/types';
import type {
  BackupMedia,
  BackupPodcastFilters,
  BackupPluginStorage,
  BackupRadioFilters,
  BackupSettings,
  BackupSources,
} from './schema';

export function collectMedia(): BackupMedia {
  const playlists = usePlaylistsStore();
  const history = useHistoryStore();
  const dislikes = useDislikesStore();
  return {
    playlists: Object.values(playlists.playlists),
    history: history.entries,
    dislikes: dislikes.entries,
  };
}

export async function collectSources(): Promise<BackupSources> {
  const radioFilters: BackupRadioFilters = {
    topLimit: Number(localStorage.getItem('radio:topLimit') || 15),
    topOrder: localStorage.getItem('radio:topOrder') || 'clickCount',
    topCountry: localStorage.getItem('radio:topCountry') || '',
    topTags: JSON.parse(localStorage.getItem('radio:topTags') || '[]'),
  };

  const podcastFilters: BackupPodcastFilters = {
    topLimit: Number(localStorage.getItem('podcasts:topLimit') || 15),
    country: localStorage.getItem('podcasts:country') || 'ru',
    genre: localStorage.getItem('podcasts:genre') || '',
  };

  const podcastsData = await idbGet<PersistedSubscriptions>('podcasts:subscriptions');

  return {
    radio: {
      savedStations: JSON.parse(localStorage.getItem('radio:saved-stations') || '[]'),
      searchQuery: localStorage.getItem('radio:searchQuery') || '',
      filters: radioFilters,
    },
    podcasts: {
      subscriptions: podcastsData?.subscriptions ?? [],
      searchQuery: localStorage.getItem('podcasts:searchQuery') || '',
      filters: podcastFilters,
    },
  };
}

/**
 * Настройки приложения + то, что плагины объявили в `manifest.backup`.
 * Плагин без `backup` в манифесте в бэкап не попадает — ядро не знает его ключей.
 */
export async function collectSettings(): Promise<BackupSettings> {
  const uiSettings = useUiSettingsStore();
  const pluginStorage: Record<string, BackupPluginStorage> = {};

  for (const manifest of getPlugins()) {
    const backup = manifest.backup;
    if (!backup) continue;

    const entry: BackupPluginStorage = {};

    if (backup.localStorageKeys && backup.localStorageKeys.length > 0) {
      const lsData: Record<string, string> = {};
      for (const key of backup.localStorageKeys) {
        const value = localStorage.getItem(key);
        if (value !== null) {
          lsData[key] = value;
        }
      }
      if (Object.keys(lsData).length > 0) {
        entry.localStorage = lsData;
      }
    }

    if (backup.idbKeys && backup.idbKeys.length > 0) {
      const idbData: Record<string, unknown> = {};
      for (const key of backup.idbKeys) {
        const value = await idbGet(key);
        if (value !== undefined) {
          idbData[key] = value;
        }
      }
      if (Object.keys(idbData).length > 0) {
        entry.idb = idbData;
      }
    }

    if (entry.localStorage || entry.idb) {
      pluginStorage[manifest.id] = entry;
    }
  }

  return {
    app: {
      theme: themeService.current.value,
      showSource: uiSettings.showSource,
      showFiles: uiSettings.showFiles,
      autoFetchMetadata: uiSettings.autoFetchMetadata,
    },
    thresholds: {
      metadata: uiSettings.metadataThreshold,
      search: uiSettings.searchThreshold,
      playlistMatch: uiSettings.playlistMatchThreshold,
    },
    plugins: pluginStorage,
  };
}
