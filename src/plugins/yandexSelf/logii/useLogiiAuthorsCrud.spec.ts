// src/plugins/yandexSelf/logii/useLogiiAuthorsCrud.spec.ts

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { computed, ref } from 'vue';
import type { FolderRef } from '@/types/folder';
import { newFolderId } from '@/types/ids';
import type { LogiiAuthorItem } from './useLogiiData';
import { useLogiiAuthorsCrud } from './useLogiiAuthorsCrud';

// Partial-mock: оставляем реальные loadPlugin, мокаем остальные
vi.mock('@/plugins/registry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/plugins/registry')>();
  return { ...actual, loadPlugin: vi.fn().mockResolvedValue({ scanFolder: vi.fn() }) };
});

vi.mock('@/services/ui/ModalService', () => ({
  modalService: {
    show: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('@/services/ui/ToastService', () => ({
  toastService: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../YandexSelfService', () => ({
  yandexSelfService: {
    createFolder: vi.fn().mockResolvedValue(undefined),
    moveResource: vi.fn().mockResolvedValue(undefined),
    removeResource: vi.fn().mockResolvedValue(undefined),
  },
}));

const SEASON_URL = 'logii.S';

function folderStub(overrides: Partial<FolderRef> = {}): FolderRef {
  return {
    id: newFolderId(),
    pluginId: 'yandex-self',
    name: 'S',
    parentId: null,
    urlPath: SEASON_URL,
    trackIds: [],
    files: [],
    scanState: 'scanned',
    scanStateUpdatedAt: 0,
    ...overrides,
  };
}

function authorStub(overrides: Partial<LogiiAuthorItem> = {}): LogiiAuthorItem {
  return {
    folderName: 'uA',
    urlPath: `${SEASON_URL}/uA`,
    ...overrides,
  };
}

describe('useLogiiAuthorsCrud', () => {
  const mockRouterReplace = vi.fn();
  const mockRenameFolder = vi.fn().mockResolvedValue(true);
  const mockRemoveResource = vi.fn().mockResolvedValue(true);

  const seasonFolder = ref<FolderRef | null>(folderStub());
  const currentAuthorName = ref('uA');
  const isWriting = ref(false);

  const router = { replace: mockRouterReplace };
  let confirmResult = true;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRenameFolder.mockResolvedValue(true);
    mockRemoveResource.mockResolvedValue(true);
    confirmResult = true;
    isWriting.value = false;
    seasonFolder.value = folderStub();
    currentAuthorName.value = 'uA';
  });

  function setup() {
    const result = useLogiiAuthorsCrud({
      seasonFolder: computed(() => seasonFolder.value),
      currentAuthorName: computed(() => currentAuthorName.value),
      isWriting: computed(() => isWriting.value),
      renameFolder: mockRenameFolder,
      removeResource: mockRemoveResource,
      router,
      confirmFn: () => confirmResult,
    });
    return { ...result };
  }

  describe('openCreateModal: guard-условия', () => {
    it('не открывает модалку когда isWriting=true', async () => {
      isWriting.value = true;
      const { openCreateModal } = setup();
      const { modalService } = await import('@/services/ui/ModalService');
      await openCreateModal();
      expect(modalService.show).not.toHaveBeenCalled();
    });

    it('не открывает модалку когда seasonFolder=null', async () => {
      seasonFolder.value = null;
      const { openCreateModal } = setup();
      const { modalService } = await import('@/services/ui/ModalService');
      await openCreateModal();
      expect(modalService.show).not.toHaveBeenCalled();
    });
  });

  describe('openRenameModal: guard-условия', () => {
    it('не открывает модалку когда isWriting=true', async () => {
      isWriting.value = true;
      const { openRenameModal } = setup();
      const { modalService } = await import('@/services/ui/ModalService');
      await openRenameModal(authorStub());
      expect(modalService.show).not.toHaveBeenCalled();
    });
  });

  describe('onDeleteAuthor: guard-условия и маршрутизация', () => {
    it('не удаляет когда isWriting=true', async () => {
      isWriting.value = true;
      const { onDeleteAuthor } = setup();
      await onDeleteAuthor(authorStub());
      expect(mockRemoveResource).not.toHaveBeenCalled();
    });

    it('не удаляет при отмене confirm', async () => {
      confirmResult = false;
      const { onDeleteAuthor } = setup();
      await onDeleteAuthor(authorStub());
      expect(mockRemoveResource).not.toHaveBeenCalled();
    });

    it('вызывает removeResource когда подтверждено', async () => {
      const { onDeleteAuthor } = setup();
      await onDeleteAuthor(authorStub());
      expect(mockRemoveResource).toHaveBeenCalledWith(`${SEASON_URL}/uA`, SEASON_URL);
    });

    it('не переключает роут когда автор не текущий', async () => {
      currentAuthorName.value = 'uB';
      const { onDeleteAuthor } = setup();
      await onDeleteAuthor(authorStub());
      expect(mockRouterReplace).not.toHaveBeenCalled();
    });

    it('переключает роут при удалении текущего автора', async () => {
      const { onDeleteAuthor } = setup();
      await onDeleteAuthor(authorStub());
      expect(mockRouterReplace).toHaveBeenCalledTimes(1);
      const to = mockRouterReplace.mock.calls[0]![0] as { name: string; params: { pluginId: string } };
      expect(to.name).toBe('folder');
      expect(to.params.pluginId).toBe('yandex-self');
    });

    it('не переключает роут если removeResource вернул false', async () => {
      mockRemoveResource.mockResolvedValue(false);
      const { onDeleteAuthor } = setup();
      await onDeleteAuthor(authorStub());
      expect(mockRouterReplace).not.toHaveBeenCalled();
    });
  });
});
