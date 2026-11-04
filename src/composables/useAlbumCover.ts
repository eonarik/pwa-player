// src/composables/useAlbumCover.ts

import { computed, onUnmounted, ref, watch, type Ref } from 'vue';
import { useLibraryStore } from '@/stores/library';
import type { AlbumId } from '@/types/ids';

/**
 * Резолвит обложку альбома:
 * 1. Album.coverBlob (первично) → blob: URL.
 * 2. Album.coverUrl (вторично).
 * 3. null → caller решает (track-cover_empty, fallback-иконка).
 *
 * Blob URL создаётся при монтировании, revoke при размонтировании
 * или смене blob.
 */
export function useAlbumCover(albumId: Ref<AlbumId | null | undefined>): Ref<string | null> {
  const library = useLibraryStore();
  const blobUrl = ref<string | null>(null);
  let currentBlob: Blob | null = null;

  function revoke(): void {
    if (blobUrl.value) {
      URL.revokeObjectURL(blobUrl.value);
      blobUrl.value = null;
    }
    currentBlob = null;
  }

  watch(
    () => {
      const id = albumId.value;
      if (!id) return null;
      return library.getAlbum(id) ?? null;
    },
    (album) => {
      if (!album) {
        revoke();
        return;
      }

      const blob = album.coverBlob ?? null;
      if (blob === currentBlob) return;

      revoke();

      if (blob) {
        currentBlob = blob;
        blobUrl.value = URL.createObjectURL(blob);
      }
    },
    { immediate: true },
  );

  onUnmounted(revoke);

  return computed(() => {
    const id = albumId.value;
    if (!id) return null;

    const album = library.getAlbum(id);
    if (!album) return null;

    if (album.coverBlob) return blobUrl.value;
    return album.coverUrl;
  });
}
