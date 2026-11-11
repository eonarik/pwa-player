// src/services/backup/schema.ts

import type { ThemeId } from '@/services/ui/ThemeService';
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
  /**
   * v1: `Record<pluginId, Record<flagName, boolean>>`
   * v2: `Record<pluginId, BackupPluginStorage>`
   */
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

/**
 * Проверка формы файла.
 *
 * Поля внутри секций проверяются на месте применения (`typeof`/`Array.isArray`),
 * потому что бэкап v1 отличается от v2 и частично заполнен по определению.
 */
export function validateBackup(raw: unknown): CueiBackup {
  if (!raw || typeof raw !== 'object') throw new Error('Файл не является JSON-объектом');
  const data = raw as CueiBackup;
  if (data.format !== BACKUP_FORMAT) throw new Error('Неверный формат бэкапа');
  if (typeof data.version !== 'number') throw new Error('Неверная версия бэкапа');
  if (!data.data) throw new Error('Отсутствует секция data');
  return data;
}
