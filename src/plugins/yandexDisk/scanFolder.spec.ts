// src/plugins/yandexDisk/scanFolder.spec.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scanFolderImpl } from './scanFolder';
import { folderStatusService } from '@/services/folders/FolderStatusService';
import type { IYandexService } from './types';
import type { PluginContext } from '../types';
import type { FolderId } from '@/types/ids';
import * as scanModule from './scan';

// Мокаем scanAll, чтобы не делать реальных запросов
vi.mock('./scan', () => ({
  ROOT_REMOTE_PATH: 'disk:/',
  scanAll: vi.fn(),
}));

const FOLDER_ID = 'test-folder' as FolderId;

describe('yandexDisk scanFolderImpl', () => {
  let mockService: IYandexService;
  let mockContext: PluginContext;
  let mockStorage: any;

  beforeEach(() => {
    folderStatusService.clear();
    vi.clearAllMocks();

    mockService = {
      isCancelled: () => false,
      buildDownloadUrl: vi.fn(),
      listResources: vi.fn(),
    } as any;

    mockStorage = {
      getPathMap: () => ({ [FOLDER_ID]: 'disk:/Test' }),
      setPathMap: vi.fn(),
      getFoldersCache: () => [],
      setFoldersCache: vi.fn(),
      mergeFoldersCache: vi.fn(),
    };

    mockContext = {
      writer: { setLibrary: vi.fn() },
    } as any;
  });

  it('выставляет статусы scanning -> scanned для папки при успешном скане', async () => {
    // Мокаем успешный ответ scanAll
    vi.mocked(scanModule.scanAll).mockImplementationOnce(async (id, service, pathMap, folderId, path, options) => {
      // Эмулируем вызов progress колбэка, как это делает реальный scanAll
      options.progress?.onStart(folderId);

      // Проверяем, что статус стал scanning во время скана
      expect(folderStatusService.isScanning(folderId)).toBe(true);

      options.progress?.onDone(folderId);

      return {
        snapshot: { folders: [{ id: folderId, parentId: null, name: 'Test', urlPath: 'Test' }], tracks: [] },
        newFolderMap: {},
        pathMap: {},
      };
    });

    await scanFolderImpl({ pluginId: 'yandex', service: mockService, storage: mockStorage }, mockContext, FOLDER_ID, {
      recursive: false,
    });

    // Проверяем финальный статус
    expect(folderStatusService.isScanned(FOLDER_ID)).toBe(true);
    // Проверяем, что библиотека сохранилась
    expect(mockContext.writer.setLibrary).toHaveBeenCalled();
  });

  it('выставляет статус error, если scanAll упал', async () => {
    vi.mocked(scanModule.scanAll).mockImplementationOnce(async (id, service, pathMap, folderId, path, options) => {
      options.progress?.onStart(folderId);
      options.progress?.onError(folderId, new Error('Network fail'));
      throw new Error('Network fail');
    });

    await expect(
      scanFolderImpl({ pluginId: 'yandex', service: mockService, storage: mockStorage }, mockContext, FOLDER_ID, {
        recursive: true,
      }),
    ).rejects.toThrow('Network fail');

    expect(folderStatusService.isError(FOLDER_ID)).toBe(true);
  });
});
