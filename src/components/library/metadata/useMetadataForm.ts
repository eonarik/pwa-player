// src/components/library/metadata/useMetadataForm.ts

import { computed, ref, type ComputedRef, type Ref } from 'vue';
import type { Album } from '@/types/album';
import type { AlbumId } from '@/types/ids';
import type { MetadataCandidate } from '@/types/metadata';
import type { Track } from '@/types/track';
import { metadataService } from '@/services/metadata/MetadataService';
import { modalService } from '@/services/ui/ModalService';
import { toastService } from '@/services/ui/ToastService';
import type { MetadataCandidates } from './useMetadataCandidates';

export interface MetadataFormLibrary {
  getAlbum(id: AlbumId): Album | null;
  tracks: Record<string, Track>;
}

export interface MetadataForm {
  artist: Ref<string>;
  title: Ref<string>;
  album: Ref<string>;
  isDirty: ComputedRef<boolean>;
  allArtists: ComputedRef<string[]>;
  applyCandidate: (candidate: MetadataCandidate) => void;
  save: () => Promise<void>;
  cancel: () => void;
}

/**
 * Ручное редактирование метаданных: три поля, «грязность» для защитного
 * закрытия и сохранение через кандидата (сохраняет провайдер) либо вручную.
 */
export function useMetadataForm(deps: {
  track: Ref<Track>;
  library: MetadataFormLibrary;
  candidates: MetadataCandidates;
}): MetadataForm {
  const currentAlbum = computed(() => {
    if (!deps.track.value.albumId) return null;
    return deps.library.getAlbum(deps.track.value.albumId);
  });

  const initialArtist = deps.track.value.artist ?? '';
  const initialTitle = deps.track.value.title ?? '';
  const initialAlbum = currentAlbum.value?.name ?? '';

  const artist = ref(initialArtist);
  const title = ref(initialTitle);
  const album = ref(initialAlbum);

  const isDirty = computed(() => {
    return artist.value !== initialArtist || title.value !== initialTitle || album.value !== initialAlbum;
  });

  const allArtists = computed(() => {
    return Array.from(
      new Set(
        Object.values(deps.library.tracks)
          .map((t) => t.artist?.trim())
          .filter((a): a is string => Boolean(a)),
      ),
    ).sort((a, b) => a.localeCompare(b, 'ru'));
  });

  function applyCandidate(candidate: MetadataCandidate): void {
    artist.value = candidate.artist;
    title.value = candidate.title;
    album.value = candidate.album;
  }

  async function save(): Promise<void> {
    const newArtist = artist.value.trim();
    const newTitle = title.value.trim();
    const newAlbum = album.value.trim();

    if (!newTitle) {
      toastService.error('Название трека не может быть пустым');
      return;
    }

    // Выбранный кандидат применяем через applyCandidate: он сохраняет
    // provider/extMetadata, а провайдер сам решает, что с ними делать.
    const index = deps.candidates.selectedIndex.value;
    if (index !== null) {
      const candidate = deps.candidates.candidates.value[index];
      if (candidate) {
        await metadataService.applyCandidate(deps.track.value.id, {
          ...candidate,
          artist: newArtist,
          title: newTitle,
          album: newAlbum,
        });
        toastService.success('Метаданные обновлены');
        modalService.confirm();
        return;
      }
    }

    metadataService.updateManual(deps.track.value.id, {
      artist: newArtist,
      title: newTitle,
      album: newAlbum,
      coverUrl: undefined,
    });

    toastService.success('Метаданные обновлены');
    modalService.confirm();
  }

  function cancel(): void {
    if (isDirty.value) {
      const confirmed = window.confirm('Есть несохраненные изменения. Закрыть без сохранения?');
      if (!confirmed) return;
    }
    modalService.cancel();
  }

  return { artist, title, album, isDirty, allArtists, applyCandidate, save, cancel };
}
