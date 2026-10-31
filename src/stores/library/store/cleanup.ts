// src/stores/library/store/cleanup.ts

import type { Track } from '@/types/track';
import type { AlbumId, TrackId } from '@/types/ids';
import type { LibraryRefs } from './state';
import type { createLibraryComputed } from './computed';

type Computed = ReturnType<typeof createLibraryComputed>;

export function createLibraryCleanup(refs: LibraryRefs, computed: Computed) {
  const { tracks, albums, folders } = refs;
  const { tracksByAlbumId } = computed;

  function cleanupOrphanAlbums(): void {
    const orphanIds: AlbumId[] = [];
    for (const [id, album] of Object.entries(albums.value)) {
      if (!tracksByAlbumId.value[album.id]) {
        orphanIds.push(id as AlbumId);
      }
    }
    for (const id of orphanIds) {
      delete albums.value[id];
    }
  }

  /**
   * Удаляет треки-сироты.
   *
   * Сирота — трек, у которого:
   * - нет `local` / `cloud` source (только `streaming` или вообще нет);
   * - нет в `playlists.trackIds`;
   * - нет в `history.playedAt`;
   * - нет в `dislikes.dislikedAt`;
   * - нет в `queue`;
   * - нет ни в одном `folder.trackIds`.
   *
   * `streaming`-source (например, Zvuk) НЕ считается «живым» — такие треки
   * могут быть кешем от `restoreUnavailable` и удаляться, если больше не нужны.
   */
  function cleanupOrphanTracks(
    playlists: Record<string, { trackIds: string[] }>,
    history: { playedAt: Record<string, number> },
    dislikes: { dislikedAt: Record<string, number> },
    queue: Track[],
  ): void {
    const usedIds = new Set<string>();

    for (const p of Object.values(playlists)) {
      for (const id of p.trackIds) usedIds.add(id);
    }
    for (const id of Object.keys(history.playedAt)) usedIds.add(id);
    for (const id of Object.keys(dislikes.dislikedAt)) usedIds.add(id);
    for (const track of queue) usedIds.add(track.id);

    for (const folder of Object.values(folders.value)) {
      for (const id of folder.trackIds) usedIds.add(id);
    }

    for (const [id, track] of Object.entries(tracks.value)) {
      const hasPersistentSource = track.sources.some((s) => s.kind === 'local' || s.kind === 'cloud');
      if (!hasPersistentSource && !usedIds.has(id)) {
        delete tracks.value[id as TrackId];
      }
    }
  }

  return {
    cleanupOrphanAlbums,
    cleanupOrphanTracks,
  };
}
