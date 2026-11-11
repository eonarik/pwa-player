// src/services/backup/restore.ts

import { set as idbSet } from 'idb-keyval';
import { usePlaylistsStore } from '@/stores/playlists';
import { useHistoryStore } from '@/stores/history';
import { useDislikesStore } from '@/stores/dislikes';
import { useUiSettingsStore } from '@/stores/uiSettings';
import { themeService } from '@/services/ui/ThemeService';
import { getPlugins } from '@/plugins/registry';
import type { PersistedSubscriptions } from '@/plugins/podcasts/types';
import type { TrackId } from '@/types/ids';
import { logger } from '@/utils/logger';
import type { BackupMedia, BackupSettings, BackupSources } from './schema';

export function applyMedia(media: BackupMedia): void {
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

export async function applySources(sources: BackupSources): Promise<void> {
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

/**
 * @param version версия формата бэкапа: v1 хранил флаги плагинов как
 * `Record<pluginId, Record<flagName, boolean>>`, v2 — реальные ключи манифеста.
 */
export async function applySettings(settings: BackupSettings, version: number): Promise<void> {
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
      await applyLegacyPluginFlags(settings.plugins);
    } else {
      await applyPluginStorage(settings.plugins);
    }
  }

  await uiSettings.flush();
}

/**
 * v1: Record<pluginId, Record<flagName, boolean>>
 * Имя флага восстанавливается из последней сегмента ключа (`radio:connected` → `connected`).
 */
async function applyLegacyPluginFlags(plugins: BackupSettings['plugins']): Promise<void> {
  const legacyPlugins = plugins as unknown as Record<string, Record<string, boolean>>;
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
}

/**
 * v2: Record<pluginId, { localStorage?, idb? }>.
 * Ключи сверяются с манифестом: чужие ключи в localStorage/IDB не пишем.
 */
async function applyPluginStorage(plugins: BackupSettings['plugins']): Promise<void> {
  for (const [pluginId, entry] of Object.entries(plugins)) {
    const manifest = getPlugins().find((p) => p.id === pluginId);
    if (!manifest) {
      logger.warn(`[backup] skipping plugin "${pluginId}": not found in registry`);
      continue;
    }

    const keys = manifest.backup?.localStorageKeys;
    if (entry.localStorage) {
      for (const [key, value] of Object.entries(entry.localStorage)) {
        if (keys?.includes(key)) {
          localStorage.setItem(key, value);
        } else {
          logger.warn(`[backup] skipping key "${key}" for plugin "${pluginId}": not in manifest.backup`);
        }
      }
    }

    const idbKeys = manifest.backup?.idbKeys;
    if (entry.idb) {
      for (const [key, value] of Object.entries(entry.idb)) {
        if (idbKeys?.includes(key)) {
          await idbSet(key, value);
        } else {
          logger.warn(`[backup] skipping idb key "${key}" for plugin "${pluginId}": not in manifest.backup`);
        }
      }
    }
  }
}
