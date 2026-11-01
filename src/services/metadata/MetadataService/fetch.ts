// src/services/metadata/MetadataService/fetch.ts

import { useLibraryStore, createLibraryWriter } from '@/stores/library';
import { useUiSettingsStore } from '@/stores/uiSettings';
import type { MetadataCandidate } from '@/types/metadata';
import type { TrackId } from '@/types/ids';
import { newMetadataCandidateId } from '@/types/ids';
import type { FetchResult } from './types';
import type { MetadataPersistence } from './persistence';
import type { MetadataResolve } from './resolve';
import type { MetadataApply } from './apply';

export function createMetadataFetch(persistence: MetadataPersistence, resolve: MetadataResolve, apply: MetadataApply) {
  async function fetchAndApply(trackId: TrackId, signal?: AbortSignal, force = false): Promise<FetchResult> {
    console.log('[fetchAndApply] START', { trackId, force });
    const library = useLibraryStore();
    const uiSettings = useUiSettingsStore();
    const track = library.getTrack(trackId);

    if (!track) return { status: 'skipped', reason: 'not-found' };
    if (track.hasId3Tags && !force) return { status: 'skipped', reason: 'protected' };
    if (signal?.aborted) return { status: 'aborted' };

    const threshold = uiSettings.metadataThreshold;
    const result = await resolve.resolveCandidates(track.artist ?? '', track.title, 'sequential', threshold, signal);
    console.log('[fetchAndApply] resolve result', result.status);

    if (result.status === 'aborted') return { status: 'aborted' };
    if (result.status === 'error') return { status: 'error', message: result.message };

    if (result.status === 'not-found') {
      persistence.markNotFound(trackId);
      return { status: 'not-found' };
    }

    if (result.status === 'confident') {
      const applied = apply.applyRemote(
        trackId,
        {
          artist: result.candidate.artist,
          title: result.candidate.title,
          album: result.candidate.album,
          coverUrl: result.candidate.coverUrl,
          source: result.candidate.provider,
          similarity: result.candidate.similarity,
          confident: true,
        },
        force,
      );

      if (applied.status === 'applied' && result.candidate.extMetadata) {
        await apply.invokeApplyCandidate(result.candidate.provider, trackId, result.candidate.extMetadata);
      }

      return applied.status === 'applied' ? { status: 'applied' } : { status: 'candidates' };
    }

    // result.status === 'candidates'
    const storeTrack = library.getTrack(trackId);
    if (!storeTrack) return { status: 'not-found' };

    const writer = createLibraryWriter();
    const existingKeys = new Set(
      storeTrack.metadataCandidates.map((c) => `${c.provider}|${c.artist}|${c.title}`.toLowerCase()),
    );

    const toAdd: MetadataCandidate[] = [];
    for (const c of result.candidates) {
      const key = `${c.provider}|${c.artist}|${c.title}`.toLowerCase();
      if (existingKeys.has(key)) continue;
      existingKeys.add(key);
      toAdd.push({
        id: newMetadataCandidateId(),
        artist: c.artist,
        title: c.title,
        album: c.album,
        coverUrl: c.coverUrl,
        similarity: c.similarity,
        provider: c.provider,
        extMetadata: c.extMetadata,
      });
    }

    if (toAdd.length > 0) {
      writer.updateTrackMetadataCandidates(trackId, [...storeTrack.metadataCandidates, ...toAdd]);
    }
    return { status: 'candidates' };
  }

  async function fetchCandidates(trackId: TrackId): Promise<MetadataCandidate[]> {
    const library = useLibraryStore();
    const uiSettings = useUiSettingsStore();
    const track = library.getTrack(trackId);
    if (!track || !track.title?.trim()) return [];

    const threshold = uiSettings.metadataThreshold;
    const result = await resolve.resolveCandidates(track.artist ?? '', track.title, 'parallel', threshold);

    if (result.status === 'confident') {
      return [resolve.toCandidate(result.candidate)];
    }
    if (result.status === 'candidates') {
      return result.candidates.map((c) => resolve.toCandidate(c));
    }
    return [];
  }

  return {
    fetchAndApply,
    fetchCandidates,
  };
}

export type MetadataFetch = ReturnType<typeof createMetadataFetch>;
