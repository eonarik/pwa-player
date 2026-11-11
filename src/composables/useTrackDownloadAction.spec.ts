// src/composables/useTrackDownloadAction.spec.ts

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { computed, ref } from 'vue';
import type { Track } from '@/types/track';
import { newTrackId, type TrackId } from '@/types/ids';
import { DownloadError } from '@/services/download/types';
import { useTrackDownloadAction } from './useTrackDownloadAction';

const h = vi.hoisted(() => ({
  isDownloading: vi.fn((_id: TrackId) => false),
  getProgress: vi.fn((_id: TrackId): { written: number; total: number } | null => null),
  cancel: vi.fn((_id: TrackId) => undefined),
  removeDownloaded: vi.fn(async (_t: Track): Promise<boolean> => true),
  downloadTrack: vi.fn(async (_t: Track): Promise<boolean> => true),
  hasSpace: true,
  pickSpace: vi.fn(async (): Promise<boolean> => true),
  hasLocalSource: vi.fn((_t: Track | null | undefined) => false),
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
}));

vi.mock('@/services/download/DownloadOrchestrator', () => ({
  downloadOrchestrator: {
    isDownloading: h.isDownloading,
    getProgress: h.getProgress,
    cancel: h.cancel,
    removeDownloaded: h.removeDownloaded,
    downloadTrack: h.downloadTrack,
  },
}));
vi.mock('@/services/download/DownloadSpaceService', () => ({
  downloadSpaceService: {
    get hasSpace() {
      return { value: h.hasSpace };
    },
    pickSpace: h.pickSpace,
  },
}));
vi.mock('@/services/library/selectors', () => ({ hasLocalSource: h.hasLocalSource }));
vi.mock('@/services/ui/ToastService', () => ({ toastService: { success: h.success, error: h.error, info: h.info } }));

const trackId = newTrackId();

function trackStub(title = 'Title'): Track {
  return {
    id: trackId,
    pluginId: 'yandexDisk',
    artist: 'Artist',
    title,
    albumId: null,
    coverUrl: null,
    sources: [],
    metadataCandidates: [],
    duplicateTrackIds: [],
    raw: null,
    hasId3Tags: false,
  };
}

function setup(options: { libraryTrack?: Track | null } = {}) {
  const track = ref(trackStub());
  const libraryTrack = ref<Track | null>(options.libraryTrack === undefined ? track.value : options.libraryTrack);
  const api = useTrackDownloadAction(
    track,
    computed(() => libraryTrack.value),
  );
  return { ...api, track, libraryTrack, close: vi.fn() };
}

describe('useTrackDownloadAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.hasSpace = true;
    h.isDownloading.mockImplementation(() => false);
    h.getProgress.mockImplementation(() => null);
    h.hasLocalSource.mockImplementation(() => false);
    h.pickSpace.mockImplementation(async () => true);
    h.downloadTrack.mockImplementation(async () => true);
    h.removeDownloaded.mockImplementation(async () => true);
  });

  describe('прогресс', () => {
    it('без загрузки прогресс null', () => {
      const { downloadProgress } = setup();
      expect(downloadProgress.value).toBeNull();
    });

    it('без известной длительности прогресс null', () => {
      h.isDownloading.mockImplementation(() => true);
      h.getProgress.mockImplementation(() => ({ written: 10, total: 0 }));
      const { downloadProgress } = setup();
      expect(downloadProgress.value).toBeNull();
    });

    it('процент округляется', () => {
      h.isDownloading.mockImplementation(() => true);
      h.getProgress.mockImplementation(() => ({ written: 1, total: 3 }));
      const { downloadProgress } = setup();
      expect(downloadProgress.value).toBe(33);
    });

    it('isDownloading читается по id трека', () => {
      h.isDownloading.mockImplementation(() => true);
      const { isDownloading } = setup();
      expect(isDownloading.value).toBe(true);
      expect(h.isDownloading).toHaveBeenCalledWith(trackId);
    });
  });

  describe('downloadLabel', () => {
    it('загрузка с прогрессом', () => {
      h.isDownloading.mockImplementation(() => true);
      h.getProgress.mockImplementation(() => ({ written: 50, total: 100 }));
      const { downloadLabel } = setup();
      expect(downloadLabel.value).toBe('Скачивание… 50% · Отменить');
    });

    it('загрузка без прогресса', () => {
      h.isDownloading.mockImplementation(() => true);
      const { downloadLabel } = setup();
      expect(downloadLabel.value).toBe('Отменить скачивание');
    });

    it('нет трека в библиотеке — «Скачать»', () => {
      const { downloadLabel } = setup({ libraryTrack: null });
      expect(downloadLabel.value).toBe('Скачать');
    });

    it('файл на устройстве — «Удалить с устройства»', () => {
      h.hasLocalSource.mockImplementation(() => true);
      const { downloadLabel, isDownloaded } = setup();
      expect(isDownloaded.value).toBe(true);
      expect(downloadLabel.value).toBe('Удалить с устройства');
    });

    it('обычный облачный трек — «Скачать»', () => {
      const { downloadLabel } = setup();
      expect(downloadLabel.value).toBe('Скачать');
    });
  });

  describe('onDownload', () => {
    it('меню закрывается в любом случае', async () => {
      const { onDownload, close } = setup();
      await onDownload(close);
      expect(close).toHaveBeenCalledTimes(1);
    });

    it('нет трека в библиотеке — никаких действий', async () => {
      const { onDownload, close } = setup({ libraryTrack: null });
      await onDownload(close);
      expect(h.downloadTrack).not.toHaveBeenCalled();
      expect(h.removeDownloaded).not.toHaveBeenCalled();
      expect(h.cancel).not.toHaveBeenCalled();
    });

    it('во время загрузки кнопка отменяет её', async () => {
      h.isDownloading.mockImplementation(() => true);
      const { onDownload, close } = setup();

      await onDownload(close);

      expect(h.cancel).toHaveBeenCalledWith(trackId);
      expect(h.downloadTrack).not.toHaveBeenCalled();
    });

    it('локальный файл удаляется с устройства', async () => {
      h.hasLocalSource.mockImplementation(() => true);
      const { onDownload, close } = setup();

      await onDownload(close);

      expect(h.removeDownloaded).toHaveBeenCalled();
      expect(h.success).toHaveBeenCalledWith('Файл удалён с устройства');
      expect(h.downloadTrack).not.toHaveBeenCalled();
    });

    it('ошибка удаления показывает текст ошибки', async () => {
      h.hasLocalSource.mockImplementation(() => true);
      h.removeDownloaded.mockImplementation(async () => {
        throw new Error('нет доступа');
      });
      const { onDownload, close } = setup();

      await onDownload(close);

      expect(h.error).toHaveBeenCalledWith('нет доступа');
    });

    it('не-ошибка при удалении даёт общий текст', async () => {
      h.hasLocalSource.mockImplementation(() => true);
      h.removeDownloaded.mockImplementation(async () => {
        throw 'oops';
      });
      const { onDownload, close } = setup();

      await onDownload(close);

      expect(h.error).toHaveBeenCalledWith('Не удалось удалить');
    });

    it('без выбранной папки спросить её и не качать при отказе', async () => {
      h.hasSpace = false;
      h.pickSpace.mockImplementation(async () => false);
      const { onDownload, close } = setup();

      await onDownload(close);

      expect(h.pickSpace).toHaveBeenCalledTimes(1);
      expect(h.downloadTrack).not.toHaveBeenCalled();
    });

    it('успешное скачивание даёт тост', async () => {
      const { onDownload, close } = setup();

      await onDownload(close);

      expect(h.downloadTrack).toHaveBeenCalled();
      expect(h.success).toHaveBeenCalledWith('Скачивание завершено');
    });

    it('false от оркестратора — ошибка скачивания', async () => {
      h.downloadTrack.mockImplementation(async () => false);
      const { onDownload, close } = setup();

      await onDownload(close);

      expect(h.error).toHaveBeenCalledWith('Не удалось скачать трек');
    });

    it('DownloadError 404 говорит, что файла нет на Диске', async () => {
      h.downloadTrack.mockImplementation(async () => {
        throw new DownloadError(404, 'not found');
      });
      const { onDownload, close } = setup({ libraryTrack: trackStub('Трек с Диски') });

      await onDownload(close);

      expect(h.error).toHaveBeenCalledWith('Файл "Трек с Диски" не найден на Диске');
    });

    it('DownloadError 410 — то же сообщение', async () => {
      h.downloadTrack.mockImplementation(async () => {
        throw new DownloadError(410, 'gone');
      });
      const { onDownload, close } = setup({ libraryTrack: trackStub('Пропащий') });

      await onDownload(close);

      expect(h.error).toHaveBeenCalledWith('Файл "Пропащий" не найден на Диске');
    });

    it('прочий DownloadError показывает свой message', async () => {
      h.downloadTrack.mockImplementation(async () => {
        throw new DownloadError(500, 'сервер недоступен');
      });
      const { onDownload, close } = setup();

      await onDownload(close);

      expect(h.error).toHaveBeenCalledWith('сервер недоступен');
    });

    it('не-ошибка при скачивании даёт общий текст', async () => {
      h.downloadTrack.mockImplementation(async () => {
        throw 'oops';
      });
      const { onDownload, close } = setup();

      await onDownload(close);

      expect(h.error).toHaveBeenCalledWith('Не удалось скачать');
    });
  });
});
