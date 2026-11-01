// src/services/library/TrackMerger/reconcile.ts

import type { TrackId } from '@/types/ids';
import type { LibraryWriter } from '@/services/library/LibraryWriter';
import { merge } from './merge';
import { buildLibraryIndex, isSameSource, trackToPayload } from './utils';

export interface ReconcileDeps {
  writer: LibraryWriter;
  saveCache: (pluginId: string) => Promise<void>;
  replaceTrackId: (oldId: TrackId, newId: TrackId) => Promise<void>;
  threshold: number;
}

export async function reconcile(deps: ReconcileDeps): Promise<void> {
  const { writer, saveCache, replaceTrackId, threshold } = deps;
  const allTracks = writer.getAllTracks();

  const virtual = allTracks.filter((t) => !t.sources.some((s) => s.kind === 'local'));
  if (virtual.length === 0) return;

  const targets = allTracks.filter((t) => t.sources.some((s) => s.kind === 'local'));
  if (targets.length === 0) return;

  const libraryIndex = buildLibraryIndex(targets);

  for (const v of virtual) {
    // Защита: если у трека вообще нет sources (битый трек из старой версии),
    // trackToPayload упадёт. Пропускаем его (его удалит cleanupOrphanTracks).
    if (v.sources.length === 0) {
      console.warn(`[reconcile] skipping track "${v.id}" with no sources`);
      continue;
    }

    const result = merge(trackToPayload(v), {
      libraryIndex,
      existingAlbums: writer.getAllAlbums(),
      threshold,
    });

    if (result.action === 'merged-strict' && result.matchedTrackId !== null && result.matchedTrackId !== v.id) {
      const targetId = result.matchedTrackId;
      const target = writer.getTrack(targetId);
      if (!target) continue;

      const mergedSources = target.sources;
      const newSources = v.sources.filter((vs) => !mergedSources.some((ms) => isSameSource(ms, vs)));

      if (newSources.length > 0) {
        const nextSources = [...mergedSources, ...newSources].sort((a, b) => a.priority - b.priority);
        writer.updateTrackSources(targetId, nextSources);
      }

      await replaceTrackId(v.id, targetId);
      writer.removeTrack(v.id);

      await saveCache(target.sources[0]?.pluginId ?? '');
    }
  }
}
