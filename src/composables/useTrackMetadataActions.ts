// src/composables/useTrackMetadataActions.ts

import { computed, ref, type ComputedRef, type Ref } from 'vue';
import { useLibraryStore } from '@/stores/library';
import { metadataService } from '@/services/metadata/MetadataService';
import { toastService } from '@/services/ui/ToastService';
import { modalService } from '@/services/ui/ModalService';
import TrackMetadataModal from '@/components/library/TrackMetadataModal.vue';
import MetadataCandidatesModal from '@/components/library/MetadataCandidatesModal.vue';
import type { Track } from '@/types/track';
import { logger } from '@/utils/logger';

const NOT_IN_LIBRARY = 'Трек не найден в библиотеке';

/**
 * Одиночные действия над метаданными трека из контекстного меню:
 * поиск в интернете, ручное редактирование, сброс, просмотр кандидатов.
 */
export function useTrackMetadataActions(track: Ref<Track>, deps: { isStreaming: ComputedRef<boolean> }) {
  const library = useLibraryStore();

  const isSearchingMetadata = ref(false);

  const hasMetadataEdits = computed(() => Boolean(track.value.hasMetadataEdits));

  /** Трек из библиотеки: меню работает с пропом, а правки идут по библиотечной записи. */
  const libraryTrack = computed<Track | null>(() => library.getTrack(track.value.id));

  const candidateCount = computed(() => libraryTrack.value?.metadataCandidates?.length ?? 0);

  /** Трек в библиотеке; если его нет — тост и закрытие меню. */
  function requireLibraryTrack(close: () => void): Track | null {
    const libTrack = library.getTrack(track.value.id);
    if (!libTrack) {
      toastService.error(NOT_IN_LIBRARY);
      close();
    }
    return libTrack ?? null;
  }

  function openMetadataEditor(close: () => void): void {
    const libTrack = requireLibraryTrack(close);
    if (!libTrack) return;
    close();
    void modalService.show({
      title: 'Редактировать метаданные',
      type: 'custom',
      component: TrackMetadataModal,
      props: { track: libTrack },
      disableBackdropClose: true,
    });
  }

  function openCandidates(close: () => void): void {
    const libTrack = libraryTrack.value;
    if (!libTrack) return;
    close();
    void modalService.show({
      title: 'Альтернативные совпадения',
      type: 'custom',
      component: MetadataCandidatesModal,
      props: { trackIds: [libTrack.id] },
      disableBackdropClose: true,
    });
  }

  async function removeMetadata(close: () => void): Promise<void> {
    if (deps.isStreaming.value) return;

    if (!confirm('Удалить метаданные и вернуть исходные значения?')) return;

    const libTrack = requireLibraryTrack(close);
    if (!libTrack) return;

    await metadataService.reset(track.value.id);

    toastService.success('Метаданные удалены');
    close();
  }

  async function findMetadata(close: () => void): Promise<void> {
    if (isSearchingMetadata.value) return;

    const libTrack = requireLibraryTrack(close);
    if (!libTrack) return;

    if (libTrack.hasId3Tags) {
      const confirmed = await modalService.show({
        title: 'Перезаписать метаданные?',
        message: 'У трека есть ID3-теги. Поиск в интернете может заменить их ненадежными данными.',
        type: 'confirm',
        confirmLabel: 'Продолжить',
        cancelLabel: 'Отмена',
      });
      if (!confirmed) {
        close();
        return;
      }
    }

    isSearchingMetadata.value = true;
    close();

    try {
      const result = await metadataService.fetchAndApply(libTrack.id, undefined, true);

      if (result.status === 'applied') {
        toastService.success('Метаданные обновлены');
      } else if (result.status === 'candidates') {
        toastService.info('Найдены похожие варианты. Проверьте «Проблемные совпадения».');
      } else if (result.status === 'not-found') {
        toastService.info('Метаданные не найдены');
      } else if (result.status === 'error') {
        toastService.error(`Ошибка поиска: ${result.message}`);
      }
    } catch (err) {
      logger.error('[track-actions] find metadata failed', err);
      toastService.error('Не удалось найти метаданные');
    } finally {
      isSearchingMetadata.value = false;
    }
  }

  return {
    isSearchingMetadata,
    hasMetadataEdits,
    libraryTrack,
    candidateCount,
    openMetadataEditor,
    openCandidates,
    removeMetadata,
    findMetadata,
  };
}
