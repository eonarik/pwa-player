// src/services/folders/FolderStatusService.spec.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { folderStatusService } from './FolderStatusService';
import type { FolderId } from '@/types/ids';

const TEST_FOLDER_ID = 'folder-1' as FolderId;

describe('FolderStatusService', () => {
  beforeEach(() => {
    folderStatusService.clear();
    localStorage.clear();
    vi.useFakeTimers();
  });

  it('регистрирует папку со статусом по умолчанию (pending)', () => {
    folderStatusService.register(TEST_FOLDER_ID);
    expect(folderStatusService.getStatus(TEST_FOLDER_ID)).toBe('pending');
    expect(folderStatusService.needsScan(TEST_FOLDER_ID)).toBe(true);
  });

  it('не перезаписывает существующий статус при повторной регистрации', () => {
    folderStatusService.register(TEST_FOLDER_ID, 'pending');
    folderStatusService.markScanned(TEST_FOLDER_ID);
    folderStatusService.register(TEST_FOLDER_ID, 'pending');
    expect(folderStatusService.getStatus(TEST_FOLDER_ID)).toBe('scanned');
  });

  it('меняет статусы через markScanning / markScanned / markError', () => {
    folderStatusService.register(TEST_FOLDER_ID);

    folderStatusService.markScanning(TEST_FOLDER_ID);
    expect(folderStatusService.isScanning(TEST_FOLDER_ID)).toBe(true);

    folderStatusService.markError(TEST_FOLDER_ID, 'Network error');
    expect(folderStatusService.isError(TEST_FOLDER_ID)).toBe(true);
    expect(folderStatusService.getEntry(TEST_FOLDER_ID)?.errorMessage).toBe('Network error');

    folderStatusService.markScanned(TEST_FOLDER_ID);
    expect(folderStatusService.isScanned(TEST_FOLDER_ID)).toBe(true);
  });

  it('forgetMany удаляет статусы только указанных папок', () => {
    const folder2 = 'folder-2' as FolderId;
    folderStatusService.register(TEST_FOLDER_ID, 'scanned');
    folderStatusService.register(folder2, 'scanned');

    folderStatusService.forgetMany([TEST_FOLDER_ID]);

    expect(folderStatusService.getStatus(TEST_FOLDER_ID)).toBeNull();
    expect(folderStatusService.getStatus(folder2)).toBe('scanned');
  });

  it('персистит статусы в localStorage с debounce', () => {
    folderStatusService.register(TEST_FOLDER_ID, 'scanned');

    // До срабатывания таймера localStorage пуст
    expect(localStorage.getItem('player:folderStatuses')).toBeNull();

    // Проматываем время (debounce 300ms)
    vi.advanceTimersByTime(350);

    const raw = localStorage.getItem('player:folderStatuses');
    expect(raw).toBeTruthy();

    const parsed = JSON.parse(raw!);
    expect(parsed.entries[TEST_FOLDER_ID].status).toBe('scanned');
  });

  it('восстанавливает статусы из localStorage при инициализации', async () => {
    // Эмулируем "прошлую сессию": записываем данные напрямую
    const payload = {
      v: 1,
      entries: {
        [TEST_FOLDER_ID]: { status: 'scanned', updatedAt: Date.now() },
      },
    };
    localStorage.setItem('player:folderStatuses', JSON.stringify(payload));

    // Чтобы пересоздать инстанс, нам нужно сбросить модуль.
    // Так как сервис — синглтон, мы очищаем его кеш через reload модуля.
    vi.resetModules();
    const { folderStatusService: freshService } = await import('./FolderStatusService');

    expect(freshService.getStatus(TEST_FOLDER_ID)).toBe('scanned');
  });
});
