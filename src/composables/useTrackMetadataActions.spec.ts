// src/composables/useTrackMetadataActions.spec.ts

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { computed, ref } from 'vue';
import type { Track } from '@/types/track';
import type { MetadataCandidate } from '@/types/metadata';
import type { FetchResult } from '@/services/metadata/MetadataService/types';
import { asMetadataCandidateId, newTrackId, type TrackId } from '@/types/ids';
import { useTrackMetadataActions } from './useTrackMetadataActions';

const h = vi.hoisted(() => ({
  getTrack: vi.fn((_id: TrackId): Track | null => null),
  reset: vi.fn(async (_id: TrackId): Promise<void> => undefined),
  fetchAndApply: vi.fn(async (_id: TrackId, _signal?: AbortSignal, _force?: boolean): Promise<FetchResult> => ({
    status: 'applied',
  })),
  error: vi.fn(),
  success: vi.fn(),
  info: vi.fn(),
  show: vi.fn(async (_options: unknown): Promise<boolean> => true),
}));

vi.mock('@/stores/library', () => ({ useLibraryStore: () => ({ getTrack: h.getTrack }) }));
vi.mock('@/services/metadata/MetadataService', () => ({ metadataService: h }));
vi.mock('@/services/ui/ToastService', () => ({ toastService: { error: h.error, success: h.success, info: h.info } }));
vi.mock('@/services/ui/ModalService', () => ({ modalService: { show: h.show } }));
vi.mock('@/components/library/TrackMetadataModal.vue', () => ({ default: { name: 'TrackMetadataModal' } }));
vi.mock('@/components/library/MetadataCandidatesModal.vue', () => ({ default: { name: 'MetadataCandidatesModal' } }));

const trackId = newTrackId();

function trackStub(over: Partial<Track> = {}): Track {
  return {
    id: trackId,
    pluginId: 'local',
    artist: 'Artist',
    title: 'Title',
    albumId: null,
    coverUrl: null,
    sources: [],
    metadataCandidates: [],
    duplicateTrackIds: [],
    raw: null,
    hasId3Tags: false,
    ...over,
  };
}

function candidate(id: string): MetadataCandidate {
  return {
    id: asMetadataCandidateId(id),
    artist: 'A',
    title: 'T',
    album: 'Al',
    coverUrl: null,
    similarity: 0.9,
    provider: 'itunes',
  };
}

function setup(options: { track?: Track; libraryTrack?: Track | null; isStreaming?: boolean } = {}) {
  const track = ref(options.track ?? trackStub());
  h.getTrack.mockImplementation((_id: TrackId) =>
    options.libraryTrack === undefined ? track.value : options.libraryTrack,
  );
  const api = useTrackMetadataActions(track, { isStreaming: computed(() => Boolean(options.isStreaming)) });
  return { ...api, track, close: vi.fn() };
}

describe('useTrackMetadataActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.show.mockImplementation(async () => true);
    h.fetchAndApply.mockImplementation(async () => ({ status: 'applied' }));
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    );
  });

  describe('производные состояния', () => {
    it('libraryTrack и candidateCount читаются из библиотеки', () => {
      const { libraryTrack, candidateCount } = setup({
        libraryTrack: trackStub({ metadataCandidates: [candidate('c1')] }),
      });

      expect(libraryTrack.value?.id).toBe(trackId);
      expect(candidateCount.value).toBe(1);
    });

    it('трека нет в библиотеке — кандидатов ноль', () => {
      const { libraryTrack, candidateCount } = setup({ libraryTrack: null });

      expect(libraryTrack.value).toBeNull();
      expect(candidateCount.value).toBe(0);
    });

    it('hasMetadataEdits учитывает отсутствующий флаг', () => {
      expect(setup().hasMetadataEdits.value).toBe(false);
      expect(setup({ track: trackStub({ hasMetadataEdits: true }) }).hasMetadataEdits.value).toBe(true);
    });
  });

  describe('openMetadataEditor', () => {
    it('открывает модалку редактора на треке из библиотеки', () => {
      const { openMetadataEditor, close } = setup({ libraryTrack: trackStub({ title: 'Из библиотеки' }) });

      openMetadataEditor(close);

      expect(close).toHaveBeenCalledTimes(1);
      expect(h.show).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Редактировать метаданные', disableBackdropClose: true }),
      );
      const shown = h.show.mock.calls[0]![0] as { props: { track: Track } };
      expect(shown.props.track.title).toBe('Из библиотеки');
    });

    it('трека нет в библиотеке — тост, закрытие, модалка не показана', () => {
      const { openMetadataEditor, close } = setup({ libraryTrack: null });

      openMetadataEditor(close);

      expect(h.error).toHaveBeenCalledWith('Трек не найден в библиотеке');
      expect(close).toHaveBeenCalledTimes(1);
      expect(h.show).not.toHaveBeenCalled();
    });
  });

  describe('openCandidates', () => {
    it('передаёт id трека в модалку кандидатов', () => {
      const { openCandidates, close } = setup();

      openCandidates(close);

      expect(close).toHaveBeenCalledTimes(1);
      const shown = h.show.mock.calls[0]![0] as { title: string; props: { trackIds: TrackId[] } };
      expect(shown.title).toBe('Альтернативные совпадения');
      expect(shown.props.trackIds).toEqual([trackId]);
    });

    it('без трека в библиотеке не закрывает меню и не открывает модалку', () => {
      const { openCandidates, close } = setup({ libraryTrack: null });

      openCandidates(close);

      expect(close).not.toHaveBeenCalled();
      expect(h.show).not.toHaveBeenCalled();
    });
  });

  describe('removeMetadata', () => {
    it('для стриминга ничего не происходит', async () => {
      const { removeMetadata, close } = setup({ isStreaming: true });

      await removeMetadata(close);

      expect(h.reset).not.toHaveBeenCalled();
      expect(close).not.toHaveBeenCalled();
    });

    it('отказ в подтверждении отменяет сброс', async () => {
      vi.stubGlobal(
        'confirm',
        vi.fn(() => false),
      );
      const { removeMetadata, close } = setup();

      await removeMetadata(close);

      expect(h.reset).not.toHaveBeenCalled();
      expect(close).not.toHaveBeenCalled();
    });

    it('успешный сброс даёт тост и закрывает меню', async () => {
      const { removeMetadata, close } = setup();

      await removeMetadata(close);

      expect(h.reset).toHaveBeenCalledWith(trackId);
      expect(h.success).toHaveBeenCalledWith('Метаданные удалены');
      expect(close).toHaveBeenCalledTimes(1);
    });

    it('нет трека в библиотеке — тост ошибки без сброса', async () => {
      const { removeMetadata, close } = setup({ libraryTrack: null });

      await removeMetadata(close);

      expect(h.reset).not.toHaveBeenCalled();
      expect(h.error).toHaveBeenCalledWith('Трек не найден в библиотеке');
    });
  });

  describe('findMetadata', () => {
    it('трек без ID3 ищется без подтверждения перезаписи', async () => {
      const { findMetadata, close } = setup();

      await findMetadata(close);

      expect(h.show).not.toHaveBeenCalled();
      expect(h.fetchAndApply).toHaveBeenCalledWith(trackId, undefined, true);
      expect(h.success).toHaveBeenCalledWith('Метаданные обновлены');
      expect(close).toHaveBeenCalledTimes(1);
    });

    it('ID3-теги требуют подтверждения, отказ прерывает поиск', async () => {
      h.show.mockImplementation(async () => false);
      const { findMetadata, close } = setup({ track: trackStub({ hasId3Tags: true }) });

      await findMetadata(close);

      expect(h.show).toHaveBeenCalledWith(expect.objectContaining({ type: 'confirm' }));
      expect(h.fetchAndApply).not.toHaveBeenCalled();
      expect(close).toHaveBeenCalledTimes(1);
    });

    it('подтверждённый поиск по ID3-треку продолжается', async () => {
      const { findMetadata, close } = setup({ track: trackStub({ hasId3Tags: true }) });

      await findMetadata(close);

      expect(h.fetchAndApply).toHaveBeenCalledTimes(1);
    });

    it('повторный поиск во время активного игнорируется', async () => {
      let release!: () => void;
      h.fetchAndApply.mockImplementation(
        () =>
          new Promise<FetchResult>((resolve) => {
            release = () => resolve({ status: 'applied' });
          }),
      );
      const { findMetadata, isSearchingMetadata, close } = setup();

      const first = findMetadata(close);
      expect(isSearchingMetadata.value).toBe(true);

      await findMetadata(close);
      expect(h.fetchAndApply).toHaveBeenCalledTimes(1);

      release();
      await first;
      expect(isSearchingMetadata.value).toBe(false);
    });

    it('статус candidates даёт info-тост про проблемные совпадения', async () => {
      h.fetchAndApply.mockImplementation(async () => ({ status: 'candidates' }));
      const { findMetadata, close } = setup();

      await findMetadata(close);

      expect(h.info).toHaveBeenCalledWith('Найдены похожие варианты. Проверьте «Проблемные совпадения».');
    });

    it('статус not-found даёт спокойный info-тост', async () => {
      h.fetchAndApply.mockImplementation(async () => ({ status: 'not-found' }));
      const { findMetadata, close } = setup();

      await findMetadata(close);

      expect(h.info).toHaveBeenCalledWith('Метаданные не найдены');
    });

    it('статус error превращается в текст ошибки', async () => {
      h.fetchAndApply.mockImplementation(async () => ({ status: 'error', message: 'нет сети' }));
      const { findMetadata, close } = setup();

      await findMetadata(close);

      expect(h.error).toHaveBeenCalledWith('Ошибка поиска: нет сети');
    });

    it('исключение поиска показывает тост и снимает флаг поиска', async () => {
      h.fetchAndApply.mockImplementation(async () => {
        throw new Error('boom');
      });
      const { findMetadata, isSearchingMetadata, close } = setup();

      await findMetadata(close);

      expect(h.error).toHaveBeenCalledWith('Не удалось найти метаданные');
      expect(isSearchingMetadata.value).toBe(false);
    });

    it('нет трека в библиотеке — поиск не стартует', async () => {
      const { findMetadata, isSearchingMetadata, close } = setup({ libraryTrack: null });

      await findMetadata(close);

      expect(h.fetchAndApply).not.toHaveBeenCalled();
      expect(isSearchingMetadata.value).toBe(false);
      expect(h.error).toHaveBeenCalledWith('Трек не найден в библиотеке');
    });
  });
});
