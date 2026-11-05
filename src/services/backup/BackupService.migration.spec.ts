// src/services/backup/BackupService.migration.spec.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { backupService, BACKUP_FORMAT, BACKUP_VERSION, type CueiBackup } from './BackupService';

const mockPlugins: Array<{
  id: string;
  name: string;
  backup?: { localStorageKeys?: string[]; idbKeys?: string[] };
}> = [];

vi.mock('@/plugins/registry', () => ({
  getPlugins: () => mockPlugins,
}));

vi.mock('idb-keyval', () => ({
  get: vi.fn().mockResolvedValue(undefined),
  set: vi.fn().mockResolvedValue(undefined),
  del: vi.fn().mockResolvedValue(undefined),
}));

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

/**
 * Реальный v1-бэкап, как его формировал BackupService до 0.16.2.
 *
 * Ключи в v1 — это `key.split(':').pop()`, поэтому:
 * - plugin-activated:yandex-self → 'yandex-self'
 * - yandex-self-disconnected   → 'yandex-self-disconnected'
 * - yandex-disconnected        → 'yandex-disconnected'
 */
const LEGACY_BACKUP_V1 = {
  format: BACKUP_FORMAT,
  version: 1,
  exportedAt: '2026-01-01T00:00:00.000Z',
  data: {
    settings: {
      app: {
        theme: 'default',
        showSource: false,
        showFiles: false,
        autoFetchMetadata: true,
      },
      thresholds: {
        metadata: 0.75,
        search: 0.75,
        playlistMatch: 0.75,
      },
      plugins: {
        'yandex-self': {
          'yandex-self': true,
          'yandex-self-disconnected': false,
        },
        yandex: {
          'yandex-disconnected': false,
        },
      },
    },
  },
} as unknown as CueiBackup;

describe('BackupService: миграция v1 → v2 (реальный старый бэкап)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    mockPlugins.length = 0;
    vi.clearAllMocks();
  });

  it('v1 с plugin-activated:yandex-self восстанавливается корректно', async () => {
    // Плагин yandex-self задекларировал ключи в manifest.backup
    mockPlugins.push({
      id: 'yandex-self',
      name: 'Логии',
      backup: {
        localStorageKeys: ['plugin-activated:yandex-self', 'yandex-self-disconnected'],
      },
    });
    mockPlugins.push({
      id: 'yandex',
      name: 'Яндекс.Диск',
      backup: {
        localStorageKeys: ['yandex-disconnected'],
      },
    });

    await backupService.importAll(LEGACY_BACKUP_V1, ['settings']);

    // Проверяем, что plugin-activated:yandex-self = true
    expect(localStorage.getItem('plugin-activated:yandex-self')).toBe('true');
    // yandex-self-disconnected = false (было false в бэкапе)
    expect(localStorage.getItem('yandex-self-disconnected')).toBe('false');
    // yandex-disconnected = false
    expect(localStorage.getItem('yandex-disconnected')).toBe('false');
  });

  it('v1 игнорирует плагины без manifest.backup', async () => {
    // Только yandex, без yandex-self
    mockPlugins.push({
      id: 'yandex',
      name: 'Яндекс.Диск',
      backup: {
        localStorageKeys: ['yandex-disconnected'],
      },
    });

    await backupService.importAll(LEGACY_BACKUP_V1, ['settings']);

    // yandex — восстановлен
    expect(localStorage.getItem('yandex-disconnected')).toBe('false');
    // yandex-self — НЕ восстановлен (плагина нет в mockPlugins)
    expect(localStorage.getItem('plugin-activated:yandex-self')).toBeNull();
    expect(localStorage.getItem('yandex-self-disconnected')).toBeNull();
  });
});

describe('BackupService: roundtrip v2 (export → import → export)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    mockPlugins.length = 0;
    vi.clearAllMocks();
  });

  it('export → import → export даёт идентичный результат', async () => {
    mockPlugins.push({
      id: 'yandex',
      name: 'Яндекс.Диск',
      backup: {
        localStorageKeys: ['yandex-connected', 'yandex-disconnected'],
      },
    });

    // Исходное состояние
    localStorage.setItem('yandex-connected', 'true');
    localStorage.setItem('yandex-disconnected', 'false');

    const backup1 = await backupService.exportAll(['settings']);
    expect(backup1.version).toBe(BACKUP_VERSION);

    // Очищаем localStorage
    localStorage.clear();

    // Импортируем
    await backupService.importAll(backup1, ['settings']);
    expect(localStorage.getItem('yandex-connected')).toBe('true');
    expect(localStorage.getItem('yandex-disconnected')).toBe('false');

    // Экспортируем заново
    const backup2 = await backupService.exportAll(['settings']);

    // Сравниваем plugins (data.settings.plugins)
    expect(backup2.data.settings?.plugins).toEqual(backup1.data.settings?.plugins);
  });
});
