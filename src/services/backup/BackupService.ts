// src/services/backup/BackupService.ts

import { del as idbDel } from 'idb-keyval';
import { toastService } from '@/services/ui/ToastService';
import {
  ALL_DOMAINS,
  BACKUP_FORMAT,
  BACKUP_VERSION,
  validateBackup,
  type BackupDomain,
  type CueiBackup,
} from './schema';
import { collectMedia, collectSettings, collectSources } from './collect';
import { applyMedia, applySettings, applySources } from './restore';

/**
 * Фасад бэкапа: выбирает домены и вызывает collect/restore.
 * Схема файла — в `schema.ts`, чтение состояния — в `collect.ts`, запись — в `restore.ts`.
 */
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

    if (domains.includes('media')) data.media = collectMedia();
    if (domains.includes('sources')) data.sources = await collectSources();
    if (domains.includes('settings')) data.settings = await collectSettings();

    return {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      data,
    };
  }

  validate(raw: unknown): CueiBackup {
    return validateBackup(raw);
  }

  async importAll(raw: unknown, domains: BackupDomain[] = ALL_DOMAINS): Promise<void> {
    const backup = validateBackup(raw);

    if (domains.includes('media') && backup.data.media) {
      applyMedia(backup.data.media);
    }
    if (domains.includes('sources') && backup.data.sources) {
      await applySources(backup.data.sources);
    }
    if (domains.includes('settings') && backup.data.settings) {
      await applySettings(backup.data.settings, backup.version);
    }

    // Воспроизведение намеренно не восстанавливается: после импорта трек
    // не должен «подхватить» позицию из чужой сессии.
    await idbDel('player:state');
    await idbDel('player:playback');

    toastService.success('Импорт завершён. Страница перезагрузится.');
    setTimeout(() => window.location.reload(), 1000);
  }
}

export const backupService = BackupService.getInstance();

// Схема доступна через фасад — так же, как до разбиения файла.
export { BACKUP_FORMAT, BACKUP_VERSION, ALL_DOMAINS, validateBackup };
export type {
  BackupAppSettings,
  BackupDomain,
  BackupMedia,
  BackupPluginStorage,
  BackupPodcastFilters,
  BackupPodcasts,
  BackupRadio,
  BackupRadioFilters,
  BackupSettings,
  BackupSources,
  BackupThresholds,
  CueiBackup,
} from './schema';
