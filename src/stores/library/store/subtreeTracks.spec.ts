// src/stores/library/store/subtreeTracks.spec.ts

import { beforeEach, describe, expect, it } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

import { useLibraryStore } from './index';
import { newFolderId, newTrackId } from '@/types/ids';
import type { FolderId, TrackId } from '@/types/ids';
import type { FolderRef } from '@/types/folder';
import type { Track } from '@/types/track';

function makeTrack(id: TrackId): Track {
  return {
    id,
    pluginId: 'local',
    artist: 'Artist A',
    title: `Track ${id}`,
    albumId: null,
    coverUrl: null,
    sources: [],
    metadataCandidates: [],
    raw: null,
    hasId3Tags: true,
  };
}

function makeFolder(id: FolderId, parentId: FolderId | null, trackIds: TrackId[] = []): FolderRef {
  return {
    id,
    pluginId: 'local',
    name: id,
    parentId,
    urlPath: `/${id}`,
    trackIds,
    scanState: 'scanned',
    scanStateUpdatedAt: 0,
  };
}

describe('subtreeTracksMap', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('собирает треки транзитивно из всего поддерева', () => {
    const library = useLibraryStore();

    const root = newFolderId();
    const child = newFolderId();
    const grandChild = newFolderId();

    const tRoot = newTrackId();
    const tChild = newTrackId();
    const tGrand = newTrackId();

    library.tracks[tRoot] = makeTrack(tRoot);
    library.tracks[tChild] = makeTrack(tChild);
    library.tracks[tGrand] = makeTrack(tGrand);

    library.folders[root] = makeFolder(root, null, [tRoot]);
    library.folders[child] = makeFolder(child, root, [tChild]);
    library.folders[grandChild] = makeFolder(grandChild, child, [tGrand]);

    const map = library.subtreeTracksMap;
    expect(map.get(grandChild)?.map((t) => t.id)).toEqual([tGrand]);
    expect(map.get(child)?.map((t) => t.id)).toEqual([tChild, tGrand]);
    expect(map.get(root)?.map((t) => t.id)).toEqual([tRoot, tChild, tGrand]);
  });

  it('не зависает и не дублирует треки при цикле в parentId', () => {
    const library = useLibraryStore();

    const a = newFolderId();
    const b = newFolderId();
    const tA = newTrackId();
    const tB = newTrackId();

    library.tracks[tA] = makeTrack(tA);
    library.tracks[tB] = makeTrack(tB);

    // Взаимная ссылка: children у A — B, children у B — A.
    library.folders[a] = makeFolder(a, b, [tA]);
    library.folders[b] = makeFolder(b, a, [tB]);

    const map = library.subtreeTracksMap;
    const idsOf = (id: FolderId): TrackId[] => (map.get(id) ?? []).map((t) => t.id);

    // Порядок обхода при повреждённых данных не гарантируем, но обход завершается,
    // оба узла посчитаны и трек не встречается дважды в одном поддереве.
    expect(map.has(a)).toBe(true);
    expect(map.has(b)).toBe(true);
    for (const id of [a, b]) {
      const ids = idsOf(id);
      expect(new Set(ids).size).toBe(ids.length);
    }
    expect(idsOf(a)).toContain(tA);
  });

  it('folderStats считает подпапки и треки поддерева', () => {
    const library = useLibraryStore();

    const root = newFolderId();
    const child = newFolderId();
    const grandChild = newFolderId();

    const tRoot = newTrackId();
    const tChild1 = newTrackId();
    const tChild2 = newTrackId();
    const tGrand = newTrackId();

    for (const id of [tRoot, tChild1, tChild2, tGrand]) {
      library.tracks[id] = makeTrack(id);
    }

    library.folders[root] = makeFolder(root, null, [tRoot]);
    library.folders[child] = makeFolder(child, root, [tChild1, tChild2]);
    library.folders[grandChild] = makeFolder(grandChild, child, [tGrand]);

    const stats = library.folderStats;
    expect(stats.get(grandChild)).toEqual({ folders: 0, tracks: 1 });
    expect(stats.get(child)).toEqual({ folders: 1, tracks: 3 });
    expect(stats.get(root)).toEqual({ folders: 2, tracks: 4 });
  });

  it('пропускает несуществующие trackId', () => {
    const library = useLibraryStore();
    const folderId = newFolderId();
    const missing = newTrackId();
    const present = newTrackId();

    library.tracks[present] = makeTrack(present);
    library.folders[folderId] = makeFolder(folderId, null, [missing, present]);

    expect(library.subtreeTracksMap.get(folderId)?.map((t) => t.id)).toEqual([present]);
  });

  it('выдерживает глубокую вложенность без рекурсии', () => {
    const library = useLibraryStore();

    const DEPTH = 3000;

    let rootId: FolderId | null = null;
    let previousId: FolderId | null = null;

    for (let level = 0; level < DEPTH; level++) {
      const folderId = newFolderId();
      const trackId = newTrackId();

      library.tracks[trackId] = makeTrack(trackId);
      library.folders[folderId] = makeFolder(folderId, previousId, [trackId]);

      if (rootId === null) rootId = folderId;
      previousId = folderId;
    }

    if (rootId === null) throw new Error('цепочка пуста');
    expect(library.subtreeTracksMap.get(rootId)).toHaveLength(DEPTH);
  });

  it('выдерживает широкое дерево без spread-overflow', () => {
    const library = useLibraryStore();

    const root = newFolderId();
    const children: FolderId[] = [];
    const trackIds: TrackId[] = [];

    for (let i = 0; i < 5000; i++) {
      children.push(newFolderId());
      trackIds.push(newTrackId());
    }

    for (let i = 0; i < children.length; i++) {
      const childId = children[i];
      const trackId = trackIds[i];
      if (childId === undefined || trackId === undefined) continue;
      library.tracks[trackId] = makeTrack(trackId);
      library.folders[childId] = makeFolder(childId, root, [trackId]);
    }

    library.folders[root] = makeFolder(root, null, []);

    expect(library.subtreeTracksMap.get(root)).toHaveLength(5000);
  });
});
