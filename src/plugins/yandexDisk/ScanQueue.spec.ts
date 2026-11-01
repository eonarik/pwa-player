// src/plugins/yandexDisk/ScanQueue.spec.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScanQueue } from './ScanQueue';
import { folderStatusService } from '@/services/folders/FolderStatusService';
import * as scanModule from './scan';

vi.mock('./scan', () => ({
  scanAll: vi.fn(),
}));

describe('ScanQueue', () => {
  let queue: ScanQueue;
  let mockContext: any;
  let mockStorage: any;
  let mockService: any;

  beforeEach(() => {
    folderStatusService.clear();
    vi.clearAllMocks();

    mockService = {
      isCancelled: () => false,
    };

    mockStorage = {
      getPathMap: () => ({ 'folder-1': 'disk:/Folder 1', 'folder-2': 'disk:/Folder 2' }),
      setPathMap: vi.fn(),
      getFoldersCache: () => [],
      setFoldersCache: vi.fn(),
      mergeFoldersCache: vi.fn().mockReturnValue([]),
    };

    mockContext = {
      writer: { setLibrary: vi.fn() },
    };

    queue = new ScanQueue({
      pluginId: 'yandex',
      service: mockService,
      storage: mockStorage,
      context: mockContext,
      onLibraryUpdate: vi.fn(),
    });
  });

  it('не добавляет папку в очередь повторно, если она уже там', () => {
    let resolveScan: any;
    vi.mocked(scanModule.scanAll).mockImplementation(
      () =>
        new Promise((r) => {
          resolveScan = r;
        }),
    );

    const folderId = 'folder-1' as never;
    folderStatusService.register(folderId, 'pending');

    queue.enqueue(folderId);
    queue.enqueue(folderId);
    queue.enqueue(folderId);

    expect(vi.mocked(scanModule.scanAll)).toHaveBeenCalledTimes(1);

    if (resolveScan) {
      resolveScan({ snapshot: { folders: [], tracks: [] }, newFolderMap: {}, pathMap: {} });
    }
  });

  it('защита от рекурсии: если во время скана папка добавляется снова, она не дублируется', async () => {
    const folderId = 'folder-1' as never;
    folderStatusService.register(folderId, 'pending');

    vi.mocked(scanModule.scanAll).mockImplementation(async () => {
      queue.enqueue(folderId);

      return {
        snapshot: { folders: [], tracks: [] },
        newFolderMap: {},
        pathMap: {},
      };
    });

    queue.enqueue(folderId);

    await new Promise((r) => setTimeout(r, 10));

    expect(vi.mocked(scanModule.scanAll)).toHaveBeenCalledTimes(1);
  });

  it('обрабатывает ошибку сканирования и помечает папку как error', async () => {
    const folderId = 'folder-1' as never;
    folderStatusService.register(folderId, 'pending');

    vi.mocked(scanModule.scanAll).mockRejectedValue(new Error('Network error'));

    queue.enqueue(folderId);
    await new Promise((r) => setTimeout(r, 10));

    expect(folderStatusService.isError(folderId)).toBe(true);
  });

  it('при cancelAll помечает все папки (в очереди и в процессе) как error', async () => {
    const folder1 = 'folder-1' as never;
    const folder2 = 'folder-2' as never;

    // Регистрируем, как это происходит в loadImpl
    folderStatusService.register(folder1, 'pending');
    folderStatusService.register(folder2, 'pending');

    vi.mocked(scanModule.scanAll).mockImplementationOnce(() => new Promise(() => {}));

    queue.enqueue(folder1);
    queue.enqueue(folder2);

    await new Promise((r) => setTimeout(r, 10));

    queue.cancelAll();

    expect(folderStatusService.isError(folder1)).toBe(true);
    expect(folderStatusService.isError(folder2)).toBe(true);
  });
});
