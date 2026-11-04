// src/plugins/yandexDisk/ScanQueue.spec.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScanQueue } from './ScanQueue';
import * as scanModule from './scan';

vi.mock('./scan', () => ({
  scanAll: vi.fn(),
}));

describe('ScanQueue', () => {
  let queue: ScanQueue;
  let mockContext: any;
  let mockStorage: any;
  let mockService: any;
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
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockFolders = new Map();

    mockService = {
      isCancelled: () => false,
      setCancelled: vi.fn(),
    };

    mockStorage = {
      getPathMap: () => ({ 'folder-1': 'disk:/Folder 1', 'folder-2': 'disk:/Folder 2' }),
      setPathMap: vi.fn(),
      getFoldersCache: () => [],
      setFoldersCache: vi.fn(),
      mergeFoldersCache: vi.fn().mockReturnValue([]),
    };

    mockContext = {
      writer: makeWriter(),
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

    const folderId = 'folder-1';
    mockFolders.set(folderId, makeFolder(folderId, 'pending'));

    queue.enqueue(folderId as never);
    queue.enqueue(folderId as never);
    queue.enqueue(folderId as never);

    expect(vi.mocked(scanModule.scanAll)).toHaveBeenCalledTimes(1);

    if (resolveScan) {
      resolveScan({ snapshot: { folders: [], tracks: [] }, newFolderMap: {}, pathMap: {} });
    }
  });

  it('защита от рекурсии: если во время скана папка добавляется снова, она не дублируется', async () => {
    const folderId = 'folder-1';
    mockFolders.set(folderId, makeFolder(folderId, 'pending'));

    vi.mocked(scanModule.scanAll).mockImplementation(async () => {
      queue.enqueue(folderId as never);
      return { snapshot: { folders: [], tracks: [] }, newFolderMap: {}, pathMap: {} };
    });

    queue.enqueue(folderId as never);
    await new Promise((r) => setTimeout(r, 10));

    expect(vi.mocked(scanModule.scanAll)).toHaveBeenCalledTimes(1);
  });

  it('обрабатывает ошибку сканирования и помечает папку как error', async () => {
    const folderId = 'folder-1';
    mockFolders.set(folderId, makeFolder(folderId, 'pending'));

    vi.mocked(scanModule.scanAll).mockRejectedValue(new Error('Network error'));

    queue.enqueue(folderId as never);
    await new Promise((r) => setTimeout(r, 10));

    expect(mockFolders.get(folderId)?.scanState).toBe('error');
  });

  it('при cancelAll помечает все папки (в очереди и в процессе) как error', async () => {
    const folder1 = 'folder-1';
    const folder2 = 'folder-2';
    mockFolders.set(folder1, makeFolder(folder1, 'pending'));
    mockFolders.set(folder2, makeFolder(folder2, 'pending'));

    vi.mocked(scanModule.scanAll).mockImplementationOnce(() => new Promise(() => {}));

    queue.enqueue(folder1 as never);
    queue.enqueue(folder2 as never);

    await new Promise((r) => setTimeout(r, 10));

    queue.cancelAll();

    expect(mockFolders.get(folder1)?.scanState).toBe('error');
    expect(mockFolders.get(folder2)?.scanState).toBe('error');
  });
});
