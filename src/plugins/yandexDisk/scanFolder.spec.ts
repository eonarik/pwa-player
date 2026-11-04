// src/plugins/yandexDisk/scanFolder.spec.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scanFolderImpl } from './scanFolder';
import type { IYandexService } from './types';
import type { PluginContext } from '../types';
import type { FolderId } from '@/types/ids';
import * as scanModule from './scan';

vi.mock('./scan', () => ({
  ROOT_REMOTE_PATH: 'disk:/',
  scanAll: vi.fn(),
}));

const FOLDER_ID = 'test-folder' as FolderId;

describe('yandexDisk scanFolderImpl', () => {
  let mockService: IYandexService;
  let mockContext: PluginContext;
  let mockStorage: any;
  let mockFolders: Map<string, any>;

  function makeFolder(id: string, scanState = 'pending') {
    return {
      id,
      pluginId: 'yandex',
      name: id,
      parentId: null,
      urlPath: id,
      trackIds: [],
      scanState,
      scanStateUpdatedAt: Date.now(),
    };
  }

  function makeWriter() {
    return {
      getFolder: (id: string) => mockFolders.get(id) ?? null,
      getFoldersBySource: () => Array.from(mockFolders.values()),
      setFolderScanState: (id: string, state: string, opts?: any) => {
        const f = mockFolders.get(id);
        if (!f) return;
        f.scanState = state;
        f.scanProgress = state === 'scanning' ? opts?.progress : undefined;
        f.scanError = state === 'error' ? opts?.error : undefined;
        f.scanStateUpdatedAt = Date.now();
      },
      updateFolderScanProgress: (id: string, progress: any) => {
        const f = mockFolders.get(id);
        if (!f || f.scanState !== 'scanning') return;
        f.scanProgress = progress;
      },
      setLibrary: vi.fn(),
      cleanupForceScan: vi.fn(),
      cleanupOrphanAlbums: vi.fn(),
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockFolders = new Map();
    mockFolders.set(FOLDER_ID, makeFolder(FOLDER_ID, 'pending'));

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
      writer: makeWriter(),
    } as any;
  });

  it('выставляет статусы scanning -> scanned для папки при успешном скане', async () => {
    vi.mocked(scanModule.scanAll).mockImplementationOnce(async (id, service, pathMap, folderId, path, options) => {
      options.progress?.onStart(folderId as FolderId);

      expect(mockFolders.get(folderId)?.scanState).toBe('scanning');

      options.progress?.onDone(folderId as FolderId);

      return {
        snapshot: {
          folders: [{ id: folderId as FolderId, parentId: null, name: 'Test', urlPath: 'Test' }],
          tracks: [],
        },
        newFolderMap: {},
        pathMap: {},
      };
    });

    await scanFolderImpl({ pluginId: 'yandex', service: mockService, storage: mockStorage }, mockContext, FOLDER_ID, {
      recursive: false,
    });

    expect(mockFolders.get(FOLDER_ID)?.scanState).toBe('scanned');
    expect(mockContext.writer.setLibrary).toHaveBeenCalled();
  });

  it('выставляет статус error, если scanAll упал', async () => {
    vi.mocked(scanModule.scanAll).mockImplementationOnce(async (id, service, pathMap, folderId, path, options) => {
      options.progress?.onStart(folderId as FolderId);
      options.progress?.onError(folderId as FolderId, new Error('Network fail'));
      throw new Error('Network fail');
    });

    await expect(
      scanFolderImpl({ pluginId: 'yandex', service: mockService, storage: mockStorage }, mockContext, FOLDER_ID, {
        recursive: true,
      }),
    ).rejects.toThrow('Network fail');

    expect(mockFolders.get(FOLDER_ID)?.scanState).toBe('error');
  });
});
