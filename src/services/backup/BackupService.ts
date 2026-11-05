// src/services/backup/BackupService.ts

import { del as idbDel, get as idbGet, set as idbSet } from 'idb-keyval';
import { usePlaylistsStore } from '@/stores/playlists';
import { useHistoryStore } from '@/stores/history';
import { useDislikesStore } from '@/stores/dislikes';
import { useUiSettingsStore } from '@/stores/uiSettings';
import { themeService, type ThemeId } from '@/services/ui/ThemeService';
import { toastService } from '@/services/ui/ToastService';
import { getPlugins } from '@/plugins/registry';
import type { PersistedSubscriptions } from '@/plugins/podcasts/types';
import type { Playlist } from '@/types/collection';
import type { TrackId } from '@/types/ids';

export const BACKUP_FORMAT = 'cuei-backup';
export const BACKUP_VERSION = 2;

export interface BackupMedia {
  playlists: Playlist[];
  history: Array<{ trackId: TrackId; playedAt: number }>;
  dislikes: Array<{ trackId: TrackId; dislikedAt: number }>;
}

export interface BackupRadioFilters {
  topLimit: number;
  topOrder: string;
  topCountry: string;
  topTags: string[];
}

export interface BackupRadio {
  savedStations: unknown[];
  searchQuery: string;
  filters: BackupRadioFilters;
}

export interface BackupPodcastFilters {
  topLimit: number;
  country: string;
  genre: string;
}

export interface BackupPodcasts {
  subscriptions: unknown[];
  searchQuery: string;
  filters: BackupPodcastFilters;
}

export interface BackupSources {
  radio: BackupRadio;
  podcasts: BackupPodcasts;
}

export interface BackupAppSettings {
  theme: ThemeId;
  showSource: boolean;
  showFiles: boolean;
  autoFetchMetadata: boolean;
}

export interface BackupThresholds {
  metadata: number;
  search: number;
  playlistMatch: number;
}

export interface BackupPluginStorage {
  localStorage?: Record<string, string>;
  idb?: Record<string, unknown>;
}

export interface BackupSettings {
  app: BackupAppSettings;
  thresholds: BackupThresholds;
  plugins: Record<string, BackupPluginStorage>;
}

export interface CueiBackup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  data: {
    media?: BackupMedia;
    sources?: BackupSources;
    settings?: BackupSettings;
  };
}

export type BackupDomain = 'media' | 'sources' | 'settings';
export const ALL_DOMAINS: BackupDomain[] = ['media', 'sources', 'settings'];

class BackupService {
  private static instance: BackupService | null = null;

  static getInstance(): BackupService {
    if (!BackupService.instance) {
      BackupService.instance = new BackupService();
    }
    return BackupService.instance;
  }

  async exportAll(domains: BackupDomain[] = ALL_DOMAINS): Promise<CueiBackup> {
    const data: CueiBackup['data'] = {};

    if (domains.includes('media')) data.media = this.collectMedia();
    if (domains.includes('sources')) data.sources = await this.collectSources();
    if (domains.includes('settings')) data.settings = await this.collectSettings();

    return {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      data,
    };
  }

  private collectMedia(): BackupMedia {
    const playlists = usePlaylistsStore();
    const history = useHistoryStore();
    const dislikes = useDislikesStore();
    return {
      playlists: Object.values(playlists.playlists),
      history: history.entries,
      dislikes: dislikes.entries,
    };
  }

  private async collectSources(): Promise<BackupSources> {
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

  private async collectSettings(): Promise<BackupSettings> {
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

  validate(raw: unknown): CueiBackup {
    if (!raw || typeof raw !== 'object') throw new Error('Файл не является JSON-объектом');
    const data = raw as CueiBackup;
    if (data.format !== BACKUP_FORMAT) throw new Error('Неверный формат бэкапа');
    if (typeof data.version !== 'number') throw new Error('Неверная версия бэкапа');
    if (!data.data) throw new Error('Отсутствует секция data');
    return data;
  }

  async importAll(raw: unknown, domains: BackupDomain[] = ALL_DOMAINS): Promise<void> {
    const backup = this.validate(raw);

    if (domains.includes('media') && backup.data.media) {
      this.importMedia(backup.data.media);
    }
    if (domains.includes('sources') && backup.data.sources) {
      await this.importSources(backup.data.sources);
    }
    if (domains.includes('settings') && backup.data.settings) {
      await this.importSettings(backup.data.settings, backup.version);
    }

    await idbDel('player:state');
    await idbDel('player:playback');

    toastService.success('Импорт завершён. Страница перезагрузится.');
    setTimeout(() => window.location.reload(), 1000);
  }

  private importMedia(media: BackupMedia): void {
    const playlists = usePlaylistsStore();
    const history = useHistoryStore();
    const dislikes = useDislikesStore();

    if (Array.isArray(media.playlists)) {
      playlists.playlists = {};
      for (const p of media.playlists) {
        if (!p.id) continue;
        playlists.playlists[p.id] = {
          id: p.id,
          name: p.name ?? 'Без названия',
          trackIds: p.trackIds ?? [],
          createdAt: p.createdAt ?? Date.now(),
          updatedAt: p.updatedAt ?? Date.now(),
        };
      }
      playlists.save();
    }

    if (Array.isArray(media.history)) {
      const playedAt: Record<TrackId, number> = {};
      for (const e of media.history) {
        playedAt[e.trackId] = e.playedAt;
      }
      history.history.playedAt = playedAt;
      history.save();
    }

    if (Array.isArray(media.dislikes)) {
      const dislikedAt: Record<TrackId, number> = {};
      for (const e of media.dislikes) {
        dislikedAt[e.trackId] = e.dislikedAt;
      }
      dislikes.dislikes.dislikedAt = dislikedAt;
      dislikes.save();
    }
  }

  private async importSources(sources: BackupSources): Promise<void> {
    if (sources.radio) {
      localStorage.setItem('radio:saved-stations', JSON.stringify(sources.radio.savedStations ?? []));
      localStorage.setItem('radio:searchQuery', sources.radio.searchQuery ?? '');
      if (sources.radio.filters) {
        localStorage.setItem('radio:topLimit', String(sources.radio.filters.topLimit ?? 15));
        localStorage.setItem('radio:topOrder', sources.radio.filters.topOrder ?? 'clickCount');
        localStorage.setItem('radio:topCountry', sources.radio.filters.topCountry ?? '');
        localStorage.setItem('radio:topTags', JSON.stringify(sources.radio.filters.topTags ?? []));
      }
    }

    if (sources.podcasts) {
      await idbSet('podcasts:subscriptions', {
        subscriptions: sources.podcasts.subscriptions ?? [],
        savedAt: Date.now(),
      } as PersistedSubscriptions);

      localStorage.removeItem('podcasts:subscriptions');
      localStorage.setItem('podcasts:searchQuery', sources.podcasts.searchQuery ?? '');
      if (sources.podcasts.filters) {
        localStorage.setItem('podcasts:topLimit', String(sources.podcasts.filters.topLimit ?? 15));
        localStorage.setItem('podcasts:country', sources.podcasts.filters.country ?? 'ru');
        localStorage.setItem('podcasts:genre', sources.podcasts.filters.genre ?? '');
      }
    }
  }

  private async importSettings(settings: BackupSettings, version: number): Promise<void> {
    const uiSettings = useUiSettingsStore();

    if (settings.app) {
      if (settings.app.theme) themeService.apply(settings.app.theme);
      if (typeof settings.app.showSource === 'boolean') uiSettings.showSource = settings.app.showSource;
      if (typeof settings.app.showFiles === 'boolean') uiSettings.showFiles = settings.app.showFiles;
      if (typeof settings.app.autoFetchMetadata === 'boolean') {
        uiSettings.autoFetchMetadata = settings.app.autoFetchMetadata;
      }
    }

    if (settings.thresholds) {
      if (typeof settings.thresholds.metadata === 'number') {
        uiSettings.metadataThreshold = settings.thresholds.metadata;
      }
      if (typeof settings.thresholds.search === 'number') {
        uiSettings.searchThreshold = settings.thresholds.search;
      }
      if (typeof settings.thresholds.playlistMatch === 'number') {
        uiSettings.playlistMatchThreshold = settings.thresholds.playlistMatch;
      }
    }

    // Импорт плагинов (поддерживаем оба формата: v1 и v2)
    if (settings.plugins) {
      if (version < 2) {
        // v1: Record<pluginId, Record<flagName, boolean>>
        const legacyPlugins = settings.plugins as unknown as Record<string, Record<string, boolean>>;
        for (const [pluginId, flags] of Object.entries(legacyPlugins)) {
          const manifest = getPlugins().find((p) => p.id === pluginId);
          const keys = manifest?.backup?.localStorageKeys;
          if (!keys) continue;

          for (const key of keys) {
            const flagName = key.split(':').pop() || key;
            const value = flags[flagName];
            if (typeof value === 'boolean') {
              localStorage.setItem(key, value ? 'true' : 'false');
            }
          }
        }
      } else {
        // v2: Record<pluginId, { localStorage?: Record<string, string>, idb?: Record<string, unknown> }>
        for (const [pluginId, entry] of Object.entries(settings.plugins)) {
          const manifest = getPlugins().find((p) => p.id === pluginId);
          if (!manifest) {
            console.warn(`[backup] skipping plugin "${pluginId}": not found in registry`);
            continue;
          }

          const keys = manifest.backup?.localStorageKeys;
          if (entry.localStorage) {
            for (const [key, value] of Object.entries(entry.localStorage)) {
              if (keys?.includes(key)) {
                localStorage.setItem(key, value);
              } else {
                console.warn(`[backup] skipping key "${key}" for plugin "${pluginId}": not in manifest.backup`);
              }
            }
          }

          const idbKeys = manifest.backup?.idbKeys;
          if (entry.idb) {
            for (const [key, value] of Object.entries(entry.idb)) {
              if (idbKeys?.includes(key)) {
                await idbSet(key, value);
              } else {
                console.warn(`[backup] skipping idb key "${key}" for plugin "${pluginId}": not in manifest.backup`);
              }
            }
          }
        }
      }
    }

    await uiSettings.flush();
  }
}

export const backupService = BackupService.getInstance();
