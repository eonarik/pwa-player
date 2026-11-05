// src/services/backup/BackupService.spec.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { backupService, BACKUP_FORMAT, BACKUP_VERSION, type CueiBackup } from './BackupService';

// Мокаем idb-keyval (в jsdom нет indexedDB, а BackupService использует idbDel/idbSet).
vi.mock('idb-keyval', () => ({
  get: vi.fn().mockResolvedValue(undefined),
  set: vi.fn().mockResolvedValue(undefined),
  del: vi.fn().mockResolvedValue(undefined),
}));

// Мокаем getPlugins (используется в collectSettings/importSettings для manifest.backup).
const mockPlugins: Array<{
  id: string;
  name: string;
  backup?: { localStorageKeys?: string[]; idbKeys?: string[] };
}> = [];

vi.mock('@/plugins/registry', () => ({
  getPlugins: () => mockPlugins,
}));

// Мокаем stores, чтобы не тянуть всю библиотеку.
vi.mock('@/stores/playlists', () => ({
  usePlaylistsStore: () => ({ playlists: {}, save: vi.fn() }),
}));
vi.mock('@/stores/history', () => ({
  useHistoryStore: () => ({ entries: [], history: { playedAt: {} }, save: vi.fn() }),
}));
vi.mock('@/stores/dislikes', () => ({
  useDislikesStore: () => ({ entries: [], dislikes: { dislikedAt: {} }, save: vi.fn() }),
}));
vi.mock('@/stores/uiSettings', () => ({
  useUiSettingsStore: () => ({
    showSource: false,
    showFiles: false,
    autoFetchMetadata: true,
    metadataThreshold: 0.75,
    searchThreshold: 0.75,
    playlistMatchThreshold: 0.75,
    flush: vi.fn(),
  }),
}));
vi.mock('@/services/ui/ThemeService', () => ({
  themeService: { current: { value: 'default' }, apply: vi.fn() },
}));
vi.mock('@/services/ui/ToastService', () => ({
  toastService: { success: vi.fn() },
}));

describe('BackupService: plugin storage (v2)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    mockPlugins.length = 0;
    vi.clearAllMocks();
  });

  describe('collectSettings', () => {
    it('собирает localStorageKeys из manifest.backup', async () => {
      mockPlugins.push({
        id: 'yandex',
        name: 'Яндекс.Диск',
        backup: { localStorageKeys: ['yandex-connected', 'yandex-disconnected'] },
      });
      localStorage.setItem('yandex-connected', 'true');
      localStorage.setItem('yandex-disconnected', 'false');
      localStorage.setItem('unrelated-key', 'ignored');

      const backup = await backupService.exportAll(['settings']);

      expect(backup.version).toBe(BACKUP_VERSION);
      expect(backup.version).toBe(2);
      expect(backup.data.settings?.plugins).toEqual({
        yandex: {
          localStorage: {
            'yandex-connected': 'true',
            'yandex-disconnected': 'false',
          },
        },
      });
    });

    it('не собирает ничего, если у плагина нет manifest.backup', async () => {
      mockPlugins.push({ id: 'zvuk', name: 'СберЗвук' });

      const backup = await backupService.exportAll(['settings']);

      expect(backup.data.settings?.plugins).toEqual({});
    });

    it('игнорирует отсутствующие ключи (не пишет null)', async () => {
      mockPlugins.push({
        id: 'yandex-self',
        name: 'Логии',
        backup: { localStorageKeys: ['plugin-activated:yandex-self', 'yandex-self-disconnected'] },
      });
      localStorage.setItem('plugin-activated:yandex-self', 'true');
      // yandex-self-disconnected отсутствует

      const backup = await backupService.exportAll(['settings']);

      expect(backup.data.settings?.plugins['yandex-self']).toEqual({
        localStorage: { 'plugin-activated:yandex-self': 'true' },
      });
    });
  });

  describe('importSettings (v2)', () => {
    it('восстанавливает localStorageKeys из manifest.backup', async () => {
      mockPlugins.push({
        id: 'yandex',
        name: 'Яндекс.Диск',
        backup: { localStorageKeys: ['yandex-connected', 'yandex-disconnected'] },
      });

      const backup: CueiBackup = {
        format: BACKUP_FORMAT,
        version: 2,
        exportedAt: new Date().toISOString(),
        data: {
          settings: {
            app: { theme: 'default', showSource: false, showFiles: false, autoFetchMetadata: true },
            thresholds: { metadata: 0.75, search: 0.75, playlistMatch: 0.75 },
            plugins: {
              yandex: {
                localStorage: {
                  'yandex-connected': 'true',
                  'yandex-disconnected': 'false',
                },
              },
            },
          },
        },
      };

      await backupService.importAll(backup, ['settings']);

      expect(localStorage.getItem('yandex-connected')).toBe('true');
      expect(localStorage.getItem('yandex-disconnected')).toBe('false');
    });

    it('игнорирует плагины, которых нет в getPlugins', async () => {
      // mockPlugins пуст — плагина 'ghost' нет
      const backup: CueiBackup = {
        format: BACKUP_FORMAT,
        version: 2,
        exportedAt: new Date().toISOString(),
        data: {
          settings: {
            app: { theme: 'default', showSource: false, showFiles: false, autoFetchMetadata: true },
            thresholds: { metadata: 0.75, search: 0.75, playlistMatch: 0.75 },
            plugins: {
              ghost: {
                localStorage: { 'ghost-key': 'true' },
              },
            },
          },
        },
      };

      await backupService.importAll(backup, ['settings']);

      expect(localStorage.getItem('ghost-key')).toBeNull();
    });

    it('игнорирует ключи, которых нет в manifest.backup', async () => {
      mockPlugins.push({
        id: 'yandex',
        name: 'Яндекс.Диск',
        backup: { localStorageKeys: ['yandex-connected'] },
      });

      const backup: CueiBackup = {
        format: BACKUP_FORMAT,
        version: 2,
        exportedAt: new Date().toISOString(),
        data: {
          settings: {
            app: { theme: 'default', showSource: false, showFiles: false, autoFetchMetadata: true },
            thresholds: { metadata: 0.75, search: 0.75, playlistMatch: 0.75 },
            plugins: {
              yandex: {
                localStorage: {
                  'yandex-connected': 'true',
                  'unknown-key': 'injected', // не в manifest.backup
                },
              },
            },
          },
        },
      };

      await backupService.importAll(backup, ['settings']);

      expect(localStorage.getItem('yandex-connected')).toBe('true');
      expect(localStorage.getItem('unknown-key')).toBeNull();
    });
  });

  describe('importSettings (v1 → v2 миграция)', () => {
    it('старый формат Record<pluginId, Record<string, boolean>> конвертируется', async () => {
      mockPlugins.push({
        id: 'yandex',
        name: 'Яндекс.Диск',
        backup: { localStorageKeys: ['yandex-connected', 'yandex-disconnected'] },
      });

      const backupV1 = {
        format: BACKUP_FORMAT,
        version: 1,
        exportedAt: new Date().toISOString(),
        data: {
          settings: {
            app: { theme: 'default', showSource: false, showFiles: false, autoFetchMetadata: true },
            thresholds: { metadata: 0.75, search: 0.75, playlistMatch: 0.75 },
            plugins: {
              yandex: {
                'yandex-connected': true,
                'yandex-disconnected': false,
              },
            },
          },
        },
      } as unknown as CueiBackup;

      await backupService.importAll(backupV1, ['settings']);

      // Старые ключи 'yandex-connected'/'yandex-disconnected' → записываются в localStorage как строки
      expect(localStorage.getItem('yandex-connected')).toBe('true');
      expect(localStorage.getItem('yandex-disconnected')).toBe('false');
    });
  });
});
