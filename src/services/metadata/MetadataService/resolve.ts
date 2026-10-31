// src/services/metadata/MetadataService/resolve.ts

import { loadPlugin } from '@/plugins/registry';
import { trackMetadataService } from '../TrackMetadataService';
import type { MetadataCandidate } from '@/types/metadata';
import { newMetadataCandidateId } from '@/types/ids';
import type { ResolveMode, ResolveResult, RemoteResult, ResolvedCandidate } from './types';

// Единственное место, где ядро «знает» про конкретного провайдера —
// приоритетный источник для автопоиска (Zvuk идёт первым).
const ZVUK_PLUGIN_ID = 'zvuk';

export function createMetadataResolve() {
  async function resolveCandidates(
    artist: string,
    title: string,
    mode: ResolveMode,
    threshold: number,
    signal?: AbortSignal,
  ): Promise<ResolveResult> {
    if (signal?.aborted) return { status: 'aborted' };

    if (mode === 'sequential') {
      return resolveSequential(artist, title, threshold, signal);
    }
    return resolveParallel(artist, title, threshold, signal);
  }

  async function resolveSequential(
    artist: string,
    title: string,
    threshold: number,
    signal?: AbortSignal,
  ): Promise<ResolveResult> {
    // 1. Zvuk
    const zvuk = await tryZvuk(artist, title);
    if (signal?.aborted) return { status: 'aborted' };

    const zvukCandidate = mapZvukCandidate(zvuk);
    if (zvukCandidate && zvukCandidate.confident && zvukCandidate.similarity >= threshold) {
      return { status: 'confident', candidate: zvukCandidate };
    }

    // 2. iTunes/Deezer
    const remote = await tryRemote(artist, title, threshold, signal);
    if (remote.status === 'aborted') return { status: 'aborted' };
    if (remote.status === 'error') return { status: 'error', message: remote.message };
    if (remote.status === 'not-found') {
      if (zvukCandidate && zvukCandidate.similarity >= threshold) {
        return { status: 'candidates', candidates: [zvukCandidate] };
      }
      return { status: 'not-found' };
    }

    const remoteCandidates = remote.candidates;
    const confidentRemote = remoteCandidates.find((c) => c.confident && c.similarity >= threshold);
    if (confidentRemote) {
      return { status: 'confident', candidate: confidentRemote };
    }

    // 3. Никто не confident — собираем всех, кто прошёл threshold.
    const all: ResolvedCandidate[] = [];
    if (zvukCandidate && zvukCandidate.similarity >= threshold) all.push(zvukCandidate);
    all.push(...remoteCandidates.filter((c) => c.similarity >= threshold));
    all.sort((a, b) => b.similarity - a.similarity);

    if (all.length === 0) return { status: 'not-found' };
    return { status: 'candidates', candidates: all };
  }

  async function resolveParallel(
    artist: string,
    title: string,
    threshold: number,
    signal?: AbortSignal,
  ): Promise<ResolveResult> {
    const [zvukRes, remoteRes] = await Promise.all([
      tryZvuk(artist, title),
      tryRemote(artist, title, threshold, signal),
    ]);

    if (signal?.aborted || remoteRes.status === 'aborted') return { status: 'aborted' };
    if (remoteRes.status === 'error') return { status: 'error', message: remoteRes.message };

    const all: ResolvedCandidate[] = [];

    const zvukCandidate = mapZvukCandidate(zvukRes);
    if (zvukCandidate) all.push(zvukCandidate);

    if (remoteRes.status === 'ok') {
      all.push(...remoteRes.candidates);
    }

    const filtered = all.filter((c) => c.similarity >= threshold);
    if (filtered.length === 0) return { status: 'not-found' };

    // Сортировка: Zvuk-confident первым, остальное — по similarity desc.
    filtered.sort((a, b) => {
      const aIsZvukConfident = a.confident && a.provider === ZVUK_PLUGIN_ID;
      const bIsZvukConfident = b.confident && b.provider === ZVUK_PLUGIN_ID;
      if (aIsZvukConfident && !bIsZvukConfident) return -1;
      if (!aIsZvukConfident && bIsZvukConfident) return 1;
      return b.similarity - a.similarity;
    });

    const first = filtered[0]!;
    if (first.confident) {
      return { status: 'confident', candidate: first };
    }
    return { status: 'candidates', candidates: filtered };
  }

  async function tryZvuk(
    artist: string,
    title: string,
  ): Promise<{
    artist: string;
    title: string;
    album: string;
    coverUrl: string | null;
    similarity: number;
    confident: boolean;
    extMetadata?: Record<string, unknown>;
  } | null> {
    const zvukEnabled = localStorage.getItem('zvuk:fetchMetadata') !== 'false';
    if (!zvukEnabled) return null;

    try {
      const zvukPlugin = await loadPlugin(ZVUK_PLUGIN_ID);
      if (!zvukPlugin.fetchMetadata) return null;
      const data = await zvukPlugin.fetchMetadata(artist, title);
      if (!data) return null;
      return {
        artist: data.artist,
        title: data.title,
        album: data.album,
        coverUrl: data.coverUrl,
        similarity: data.similarity,
        confident: data.confident,
        extMetadata: data.extMetadata,
      };
    } catch (err) {
      console.warn('[metadata] zvuk failed', err);
      return null;
    }
  }

  function mapZvukCandidate(
    data: {
      artist: string;
      title: string;
      album: string;
      coverUrl: string | null;
      similarity: number;
      confident: boolean;
      extMetadata?: Record<string, unknown>;
    } | null,
  ): ResolvedCandidate | null {
    if (!data) return null;
    return {
      artist: data.artist,
      title: data.title,
      album: data.album,
      coverUrl: data.coverUrl,
      similarity: data.similarity,
      provider: ZVUK_PLUGIN_ID,
      confident: data.confident,
      extMetadata: data.extMetadata,
    };
  }

  async function tryRemote(
    artist: string,
    title: string,
    threshold: number,
    signal?: AbortSignal,
  ): Promise<RemoteResult> {
    try {
      const result = await trackMetadataService.fetch(artist, title, threshold, signal);
      if (result.status === 'aborted') return { status: 'aborted' };
      if (result.status === 'error') return { status: 'error', message: result.message };
      if (result.status === 'not-found') return { status: 'not-found' };

      const candidates: ResolvedCandidate[] = [];

      if (result.data.candidates && result.data.candidates.length > 0) {
        for (const c of result.data.candidates) {
          candidates.push({
            artist: c.artist ?? '',
            title: c.title ?? '',
            album: c.album ?? '',
            coverUrl: c.coverUrl ?? null,
            similarity: c.similarity,
            provider: c.source,
            confident: c.similarity >= threshold,
          });
        }
      } else {
        candidates.push({
          artist: result.data.artist,
          title: result.data.title,
          album: result.data.album,
          coverUrl: result.data.coverUrl,
          similarity: result.data.similarity,
          provider: result.data.source,
          confident: result.data.confident,
        });
      }

      return { status: 'ok', candidates };
    } catch (err) {
      return { status: 'error', message: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  function toCandidate(c: ResolvedCandidate): MetadataCandidate {
    return {
      id: newMetadataCandidateId(),
      artist: c.artist,
      title: c.title,
      album: c.album,
      coverUrl: c.coverUrl,
      similarity: c.similarity,
      provider: c.provider,
      extMetadata: c.extMetadata,
    };
  }

  return {
    resolveCandidates,
    toCandidate,
  };
}

export type MetadataResolve = ReturnType<typeof createMetadataResolve>;
